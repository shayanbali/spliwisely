from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q
from decimal import Decimal
from collections import defaultdict
from datetime import timedelta
from django.contrib.auth import get_user_model
from groups.serializers import UserBriefSerializer
from groups.models import Group
from groups.models import GroupMember
from .models import Expense, ExpenseSplit, ExpenseApproval, Settlement, RecurringExpense
from .serializers import ExpenseSerializer, SettlementSerializer, RecurringExpenseSerializer
from users.notifications import send_push
from .balance_engine import compute_net_balances, simplify_debts
from .exchange_rates import get_rates, convert

User = get_user_model()


class ExpenseListCreateView(generics.ListCreateAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        group_id = self.request.query_params.get('group')
        if group_id:
            qs = Expense.objects.filter(
                group_id=group_id,
                group__members__user=self.request.user,
            ).distinct()
        else:
            qs = Expense.objects.filter(splits__user=self.request.user).distinct()
        return qs.select_related('paid_by', 'group').prefetch_related('splits__user', 'approvals__user')

    def perform_create(self, serializer):
        group_id = self.request.data.get('group')
        amount = float(self.request.data.get('amount', 0))
        initial_status = 'approved'
        try:
            group = Group.objects.get(pk=group_id)
            threshold = float(group.approval_threshold)
            if threshold > 0 and amount >= threshold:
                initial_status = 'pending'
        except (Group.DoesNotExist, TypeError, ValueError):
            pass
        expense = serializer.save(created_by=self.request.user, status=initial_status)
        if initial_status == 'pending':
            _notify_approval_needed(expense)


class ExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Expense.objects.filter(
            group__members__user=self.request.user
        ).select_related('paid_by', 'group').prefetch_related('splits__user', 'approvals__user').distinct()


class SettlementListCreateView(generics.ListCreateAPIView):
    serializer_class = SettlementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Settlement.objects.filter(Q(payer=user) | Q(receiver=user))
        group_id = self.request.query_params.get('group')
        if group_id:
            qs = qs.filter(group_id=group_id)
        return qs.select_related('payer', 'receiver', 'group')

    def perform_create(self, serializer):
        payer = serializer.validated_data.get('payer') or serializer.validated_data.get('payer_id')
        receiver = serializer.validated_data.get('receiver') or serializer.validated_data.get('receiver_id')
        if payer and receiver and payer == receiver:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'detail': 'Payer and receiver cannot be the same user.'})
        serializer.save()


class ExchangeRatesView(APIView):
    """Returns live exchange rates with USD as base. Cached for 1 hour."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rates = get_rates()
        return Response({'base': 'USD', 'rates': rates})


class BalancesView(APIView):
    """
    Pairwise balances relative to the current user, converted to the user's
    preferred currency. Positive = other person owes you. Negative = you owe them.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        group_id = request.query_params.get('group')
        preferred = user.preferred_currency
        rates = get_rates()
        balances = {}

        expenses_qs = Expense.objects.filter(
            splits__user=user, status='approved'
        ).distinct().select_related('paid_by').prefetch_related('splits__user')

        if group_id:
            expenses_qs = expenses_qs.filter(group_id=group_id)

        for expense in expenses_qs:
            paid_by = expense.paid_by
            exp_currency = expense.currency
            for split in expense.splits.all():
                if split.user == paid_by:
                    continue
                # convert split amount to preferred currency
                converted = Decimal(str(convert(float(split.amount), exp_currency, preferred, rates)))
                if paid_by == user:
                    balances[split.user_id] = balances.get(split.user_id, Decimal('0')) + converted
                elif split.user == user:
                    balances[paid_by.id] = balances.get(paid_by.id, Decimal('0')) - converted

        settlements_qs = Settlement.objects.filter(Q(payer=user) | Q(receiver=user))
        if group_id:
            settlements_qs = settlements_qs.filter(group_id=group_id)

        for s in settlements_qs:
            if s.payer_id == s.receiver_id:
                continue
            converted = Decimal(str(convert(float(s.amount), s.currency, preferred, rates)))
            if s.payer == user:
                balances[s.receiver_id] = balances.get(s.receiver_id, Decimal('0')) + converted
            else:
                balances[s.payer_id] = balances.get(s.payer_id, Decimal('0')) - converted

        significant = {
            uid: amt for uid, amt in balances.items()
            if abs(amt) >= Decimal('0.01') and uid != user.id
        }
        users_map = {u.id: u for u in User.objects.filter(id__in=significant.keys())}
        result = [
            {
                'user': UserBriefSerializer(users_map[uid], context={'request': request}).data,
                'amount': str(round(amt, 2)),
                'currency': preferred,
            }
            for uid, amt in significant.items()
            if uid in users_map
        ]
        return Response(result)


class SimplifiedBalancesView(APIView):
    """
    Transactions to settle all debts in a group. When the group has
    simplify_debts=True (default), uses the greedy minimum-transaction
    algorithm. When False, returns raw pairwise net debts.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        group_id = request.query_params.get('group')
        preferred = request.user.preferred_currency
        rates = get_rates()

        user_groups = Group.objects.filter(members__user=request.user)

        expenses_qs = Expense.objects.filter(
            group__in=user_groups, status='approved'
        ).select_related('paid_by').prefetch_related('splits')
        settlements_qs = Settlement.objects.filter(group__in=user_groups)

        use_simplification = True
        if group_id:
            expenses_qs = expenses_qs.filter(group_id=group_id)
            settlements_qs = settlements_qs.filter(group_id=group_id)
            try:
                group_obj = Group.objects.get(pk=group_id, members__user=request.user)
                use_simplification = group_obj.simplify_debts
            except Group.DoesNotExist:
                pass

        if use_simplification:
            # Greedy: collapse to per-user net, then minimise transaction count
            net = defaultdict(Decimal)
            for expense in expenses_qs:
                paid_by_id = expense.paid_by_id
                for split in expense.splits.all():
                    if split.user_id == paid_by_id:
                        continue
                    converted = Decimal(str(convert(float(split.amount), expense.currency, preferred, rates)))
                    net[paid_by_id] += converted
                    net[split.user_id] -= converted
            for s in settlements_qs:
                if s.payer_id == s.receiver_id:
                    continue
                converted = Decimal(str(convert(float(s.amount), s.currency, preferred, rates)))
                net[s.receiver_id] -= converted
                net[s.payer_id] += converted
            net_filtered = {uid: amt for uid, amt in net.items() if abs(amt) > Decimal('0.01')}
            transactions = simplify_debts(net_filtered)
        else:
            # Pairwise: keep each A↔B relationship separate
            pair = defaultdict(Decimal)  # (min_id, max_id) -> signed amount; positive = min_id owes max_id
            for expense in expenses_qs:
                paid_by_id = expense.paid_by_id
                for split in expense.splits.all():
                    if split.user_id == paid_by_id:
                        continue
                    converted = Decimal(str(convert(float(split.amount), expense.currency, preferred, rates)))
                    a, b = min(split.user_id, paid_by_id), max(split.user_id, paid_by_id)
                    pair[(a, b)] += converted if split.user_id == a else -converted
            for s in settlements_qs:
                if s.payer_id == s.receiver_id:
                    continue
                converted = Decimal(str(convert(float(s.amount), s.currency, preferred, rates)))
                a, b = min(s.payer_id, s.receiver_id), max(s.payer_id, s.receiver_id)
                pair[(a, b)] += -converted if s.payer_id == a else converted
            transactions = []
            for (a, b), net in pair.items():
                if abs(net) > Decimal('0.01'):
                    transactions.append((a, b, abs(net)) if net > 0 else (b, a, abs(net)))

        all_ids = {uid for t in transactions for uid in t[:2]}
        users_map = {u.id: u for u in User.objects.filter(id__in=all_ids)}
        result = [
            {
                'from': UserBriefSerializer(users_map[debtor_id], context={'request': request}).data,
                'to': UserBriefSerializer(users_map[creditor_id], context={'request': request}).data,
                'amount': str(round(amount, 2)),
                'currency': preferred,
            }
            for debtor_id, creditor_id, amount in transactions
            if debtor_id in users_map and creditor_id in users_map
        ]
        return Response(result)


class ActivityFeedView(APIView):
    """Combined, time-sorted feed of expenses and settlements for the current user."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        group_id = request.query_params.get('group')
        preferred = user.preferred_currency
        rates = get_rates()

        expenses_qs = Expense.objects.filter(
            splits__user=user
        ).distinct().select_related('paid_by', 'group').prefetch_related('splits__user')

        settlements_qs = Settlement.objects.filter(
            Q(payer=user) | Q(receiver=user)
        ).select_related('payer', 'receiver', 'group')

        if group_id:
            expenses_qs = expenses_qs.filter(group_id=group_id)
            settlements_qs = settlements_qs.filter(group_id=group_id)

        items = []

        for e in expenses_qs:
            my_split = next((s for s in e.splits.all() if s.user == user), None)
            my_share = str(my_split.amount) if my_split else None
            i_paid = e.paid_by == user
            converted_amount = convert(float(e.amount), e.currency, preferred, rates)
            my_share_converted = (
                str(round(convert(float(my_split.amount), e.currency, preferred, rates), 2))
                if my_split else None
            )
            items.append({
                'type': 'expense',
                'id': e.id,
                'description': e.description,
                'amount': str(e.amount),
                'currency': e.currency,
                'amount_in_preferred': str(round(converted_amount, 2)),
                'preferred_currency': preferred,
                'paid_by': UserBriefSerializer(e.paid_by, context={'request': request}).data,
                'group': e.group.name if e.group else None,
                'split_type': e.split_type,
                'my_share': my_share,
                'my_share_converted': my_share_converted,
                'i_paid': i_paid,
                'created_at': e.created_at.isoformat(),
            })

        for s in settlements_qs:
            converted_amount = convert(float(s.amount), s.currency, preferred, rates)
            items.append({
                'type': 'settlement',
                'id': s.id,
                'amount': str(s.amount),
                'currency': s.currency,
                'amount_in_preferred': str(round(converted_amount, 2)),
                'preferred_currency': preferred,
                'payer': UserBriefSerializer(s.payer, context={'request': request}).data,
                'receiver': UserBriefSerializer(s.receiver, context={'request': request}).data,
                'group': s.group.name if s.group else None,
                'note': s.note,
                'created_at': s.created_at.isoformat(),
            })

        items.sort(key=lambda x: x['created_at'], reverse=True)
        return Response(items)


class RecurringExpenseListCreateView(generics.ListCreateAPIView):
    serializer_class = RecurringExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        group_id = self.request.query_params.get('group')
        qs = RecurringExpense.objects.filter(
            group__members__user=self.request.user
        ).select_related('paid_by')
        if group_id:
            qs = qs.filter(group_id=group_id)
        return qs.distinct()


class RecurringExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RecurringExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return RecurringExpense.objects.filter(
            group__members__user=self.request.user
        ).select_related('paid_by').distinct()


class GenerateRecurringView(APIView):
    """Generate all overdue recurring expenses for the requesting user's groups."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from datetime import date
        group_id = request.data.get('group')
        today = date.today()

        qs = RecurringExpense.objects.filter(
            is_active=True,
            next_due__lte=today,
            group__members__user=request.user,
        ).distinct()
        if group_id:
            qs = qs.filter(group_id=group_id)

        count = 0
        for rec in qs:
            while rec.next_due <= today:
                rec.generate_next()
                count += 1
                # reload next_due after save
                rec.refresh_from_db(fields=['next_due'])

        return Response({'generated': count})


def _compress_image(data: bytes, max_bytes: int = 4_500_000, max_dim: int = 2000) -> bytes:
    """Resize and re-compress an image so it fits within the Claude 5 MB API limit."""
    from PIL import Image as PILImage
    import io
    img = PILImage.open(io.BytesIO(data)).convert('RGB')
    # Downscale if either dimension exceeds max_dim
    w, h = img.size
    if w > max_dim or h > max_dim:
        img.thumbnail((max_dim, max_dim), PILImage.LANCZOS)
    # Compress at decreasing quality until under the byte limit
    for quality in (85, 75, 60, 45):
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=quality, optimize=True)
        if buf.tell() <= max_bytes:
            return buf.getvalue()
    return buf.getvalue()


class ScanReceiptView(APIView):
    """Send a receipt photo to Claude vision and return structured item/total data."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        import anthropic
        import base64
        import json
        from django.conf import settings

        image_file = request.FILES.get('image')
        if not image_file:
            return Response({'error': 'No image provided'}, status=status.HTTP_400_BAD_REQUEST)

        api_key = settings.ANTHROPIC_API_KEY
        if not api_key:
            return Response({'error': 'Receipt scanning is not configured on this server'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        image_data = _compress_image(image_file.read())
        image_b64 = base64.standard_b64encode(image_data).decode('utf-8')
        media_type = 'image/jpeg'

        client = anthropic.Anthropic(api_key=api_key)

        prompt = (
            "Analyze this receipt image and extract all items and financial totals. "
            "Return a JSON object with exactly these fields:\n"
            "{\n"
            '  "items": [{"name": "string", "price": number}],\n'
            '  "subtotal": number,\n'
            '  "tax": number,\n'
            '  "service_charge": number,\n'
            '  "tip": number,\n'
            '  "total": number,\n'
            '  "currency": "USD"\n'
            "}\n\n"
            "Rules:\n"
            "- price and all numeric fields are plain numbers (not strings)\n"
            "- If tax, service_charge, or tip are not on the receipt, use 0\n"
            "- currency is an ISO 4217 code (USD, EUR, GBP, etc.)\n"
            "- subtotal is the sum of item prices before tax/service\n"
            "- total is the final charged amount\n"
            "- Return ONLY valid JSON, no markdown, no extra text"
        )

        try:
            message = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                messages=[{
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_b64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }],
            )

            raw = message.content[0].text.strip()
            # Strip markdown code fences if Claude wrapped the output
            if raw.startswith('```'):
                raw = raw.split('```')[1]
                if raw.startswith('json'):
                    raw = raw[4:]
                raw = raw.strip()

            data = json.loads(raw)
            return Response(data)

        except json.JSONDecodeError:
            return Response({'error': 'Could not parse receipt — try a clearer photo'}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class GroupBalancesView(APIView):
    """Returns each group's net balance for the current user in their preferred currency."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        preferred = user.preferred_currency
        rates = get_rates()
        groups = Group.objects.filter(members__user=user)
        result = []

        for group in groups:
            expenses_qs = Expense.objects.filter(
                group=group, splits__user=user, status='approved'
            ).distinct().select_related('paid_by').prefetch_related('splits__user')

            settlements_qs = Settlement.objects.filter(
                group=group
            ).filter(Q(payer=user) | Q(receiver=user))

            net_balance = Decimal('0')
            for expense in expenses_qs:
                exp_currency = expense.currency
                for split in expense.splits.all():
                    if split.user == expense.paid_by:
                        continue
                    converted = Decimal(str(convert(float(split.amount), exp_currency, preferred, rates)))
                    if expense.paid_by == user:
                        net_balance += converted
                    elif split.user == user:
                        net_balance -= converted

            for s in settlements_qs:
                if s.payer_id == s.receiver_id:
                    continue
                converted = Decimal(str(convert(float(s.amount), s.currency, preferred, rates)))
                if s.payer == user:
                    net_balance += converted
                else:
                    net_balance -= converted

            result.append({
                'group_id': group.id,
                'balance': str(round(net_balance, 2)),
                'currency': preferred,
            })

        return Response(result)


class AnalyticsView(APIView):
    """Spending analytics: period totals + category breakdown.
    Pass ?group=<id> for group-scoped analytics with member spending breakdown.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        period = request.query_params.get('period', 'monthly')
        group_id = request.query_params.get('group')
        preferred = user.preferred_currency
        rates = get_rates()

        if group_id:
            try:
                group_obj = Group.objects.get(pk=group_id, members__user=user)
            except Group.DoesNotExist:
                return Response({'detail': 'Group not found.'}, status=status.HTTP_404_NOT_FOUND)
            expenses_qs = (
                Expense.objects
                .filter(group=group_obj)
                .distinct()
                .select_related('paid_by')
                .prefetch_related('splits__user')
                .order_by('created_at')
            )
            group_mode = True
        else:
            expenses_qs = (
                Expense.objects
                .filter(splits__user=user)
                .distinct()
                .prefetch_related('splits')
                .order_by('created_at')
            )
            group_mode = False

        period_totals: dict = {}
        period_order: list = []
        category_totals: dict = defaultdict(Decimal)
        member_spending: dict = defaultdict(Decimal)

        for expense in expenses_qs:
            if group_mode:
                amount = Decimal(str(convert(float(expense.amount), expense.currency, preferred, rates)))
                member_spending[expense.paid_by_id] += amount
            else:
                user_split = next((s for s in expense.splits.all() if s.user_id == user.id), None)
                if not user_split:
                    continue
                amount = Decimal(str(convert(float(user_split.amount), expense.currency, preferred, rates)))

            dt = expense.created_at
            if period == 'monthly':
                sort_key = dt.strftime('%Y-%m')
                label = dt.strftime('%b %Y')
            else:
                week_start = dt.date() - timedelta(days=dt.weekday())
                sort_key = week_start.strftime('%Y-%m-%d')
                label = week_start.strftime('%b %d')

            if sort_key not in period_totals:
                period_totals[sort_key] = {'label': label, 'total': Decimal('0')}
                period_order.append(sort_key)
            period_totals[sort_key]['total'] += amount

            category = expense.get_category_display()
            category_totals[category] += amount

        period_order.sort()
        last_8 = period_order[-8:]
        periods_result = [
            {'label': period_totals[k]['label'], 'total': str(round(period_totals[k]['total'], 2))}
            for k in last_8
        ]

        cat_sorted = sorted(category_totals.items(), key=lambda x: x[1], reverse=True)
        top_cats = cat_sorted[:6]
        other_total = sum(v for _, v in cat_sorted[6:])
        if other_total > Decimal('0.01'):
            top_cats.append(('Other', other_total))
        grand_total = sum(v for _, v in top_cats) or Decimal('1')
        categories_result = [
            {
                'label': k,
                'total': str(round(v, 2)),
                'percentage': round(float(v / grand_total * 100), 1),
            }
            for k, v in top_cats
        ]

        current_total = period_totals[last_8[-1]]['total'] if last_8 else Decimal('0')
        previous_total = period_totals[last_8[-2]]['total'] if len(last_8) >= 2 else Decimal('0')
        change_pct = None
        if previous_total > 0:
            change_pct = round(float((current_total - previous_total) / previous_total * 100), 1)

        response_data = {
            'periods': periods_result,
            'categories': categories_result,
            'current_total': str(round(current_total, 2)),
            'previous_total': str(round(previous_total, 2)),
            'change_pct': change_pct,
            'currency': preferred,
        }

        if group_mode and member_spending:
            total_paid = sum(member_spending.values()) or Decimal('1')
            users_map = {u.id: u for u in User.objects.filter(id__in=member_spending.keys())}
            response_data['member_spending'] = [
                {
                    'user': UserBriefSerializer(users_map[uid], context={'request': request}).data,
                    'amount': str(round(amt, 2)),
                    'percentage': round(float(amt / total_paid * 100), 1),
                }
                for uid, amt in sorted(member_spending.items(), key=lambda x: x[1], reverse=True)
                if uid in users_map
            ]

        return Response(response_data)


# ─── Approval helpers ────────────────────────────────────────────────────────

def _notify_approval_needed(expense):
    """Push notification to all group members except the creator."""
    members = GroupMember.objects.filter(group=expense.group).exclude(
        user=expense.created_by
    ).select_related('user')
    recipients = [m.user for m in members]
    if not recipients:
        return
    creator = expense.created_by
    name = creator.name or creator.email
    send_push(
        users=recipients,
        title='Approval needed',
        body=f'{name} added "{expense.description}" ({expense.currency} {expense.amount}) — tap to approve.',
        data={'type': 'approval_request', 'expense_id': expense.id, 'group_id': expense.group_id},
    )


def _resolve_approval(expense):
    """Check votes and auto-approve/reject the expense."""
    eligible_ids = set(
        GroupMember.objects.filter(group=expense.group)
        .exclude(user_id=expense.created_by_id)
        .values_list('user_id', flat=True)
    )
    if not eligible_ids:
        expense.status = 'approved'
        expense.save(update_fields=['status'])
        return

    votes = list(ExpenseApproval.objects.filter(expense=expense))
    rejected = any(not v.approved for v in votes)
    if rejected:
        expense.status = 'rejected'
        expense.save(update_fields=['status'])
        # Notify creator
        send_push(
            users=[expense.created_by],
            title='Expense rejected',
            body=f'"{expense.description}" was rejected by a group member.',
            data={'type': 'approval_rejected', 'expense_id': expense.id, 'group_id': expense.group_id},
        )
        return

    approved_ids = {v.user_id for v in votes if v.approved}
    # Majority rule: more than half of eligible members
    if len(approved_ids) > len(eligible_ids) / 2:
        expense.status = 'approved'
        expense.save(update_fields=['status'])
        members = GroupMember.objects.filter(group=expense.group).select_related('user')
        send_push(
            users=[m.user for m in members],
            title='Expense approved',
            body=f'"{expense.description}" has been approved.',
            data={'type': 'approval_approved', 'expense_id': expense.id, 'group_id': expense.group_id},
        )


class ExpenseVoteView(APIView):
    """POST /expenses/<pk>/vote/ — body: {approved: true|false}"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        expense = Expense.objects.select_related('group', 'created_by').prefetch_related(
            'approvals'
        ).filter(
            group__members__user=request.user
        ).filter(pk=pk).distinct().first()

        if not expense:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if expense.status != 'pending':
            return Response({'detail': 'Expense is not pending approval.'}, status=status.HTTP_400_BAD_REQUEST)

        if expense.created_by == request.user:
            return Response({'detail': 'You cannot vote on your own expense.'}, status=status.HTTP_400_BAD_REQUEST)

        is_member = GroupMember.objects.filter(group=expense.group, user=request.user).exists()
        if not is_member:
            return Response({'detail': 'Not a group member.'}, status=status.HTTP_403_FORBIDDEN)

        approved_flag = bool(request.data.get('approved', True))
        ExpenseApproval.objects.update_or_create(
            expense=expense, user=request.user,
            defaults={'approved': approved_flag},
        )

        _resolve_approval(expense)
        expense.refresh_from_db()
        return Response({'status': expense.status})
