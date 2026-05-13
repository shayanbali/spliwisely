from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q
from decimal import Decimal
from collections import defaultdict
from django.contrib.auth import get_user_model
from groups.serializers import UserBriefSerializer
from groups.models import Group
from .models import Expense, ExpenseSplit, Settlement
from .serializers import ExpenseSerializer, SettlementSerializer
from .balance_engine import compute_net_balances, simplify_debts
from .exchange_rates import get_rates, convert

User = get_user_model()


class ExpenseListCreateView(generics.ListCreateAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        group_id = self.request.query_params.get('group')
        if group_id:
            # Show all expenses in the group to any group member
            qs = Expense.objects.filter(
                group_id=group_id,
                group__members__user=self.request.user,
            ).distinct()
        else:
            # Global view: only expenses the user participates in
            qs = Expense.objects.filter(splits__user=self.request.user).distinct()
        return qs.select_related('paid_by', 'group').prefetch_related('splits__user')


class ExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Expense.objects.filter(
            group__members__user=self.request.user
        ).select_related('paid_by', 'group').prefetch_related('splits__user').distinct()


class SettlementListCreateView(generics.ListCreateAPIView):
    serializer_class = SettlementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Settlement.objects.filter(Q(payer=user) | Q(receiver=user))

    def perform_create(self, serializer):
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
            splits__user=user
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
            converted = Decimal(str(convert(float(s.amount), s.currency, preferred, rates)))
            if s.payer == user:
                balances[s.receiver_id] = balances.get(s.receiver_id, Decimal('0')) + converted
            else:
                balances[s.payer_id] = balances.get(s.payer_id, Decimal('0')) - converted

        significant = {uid: amt for uid, amt in balances.items() if abs(amt) >= Decimal('0.01')}
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
    Minimum transactions to settle all debts in a group, in the requesting
    user's preferred currency.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        group_id = request.query_params.get('group')
        preferred = request.user.preferred_currency
        rates = get_rates()

        user_groups = Group.objects.filter(members__user=request.user)

        expenses_qs = Expense.objects.filter(
            group__in=user_groups
        ).select_related('paid_by').prefetch_related('splits')
        settlements_qs = Settlement.objects.filter(group__in=user_groups)

        if group_id:
            expenses_qs = expenses_qs.filter(group_id=group_id)
            settlements_qs = settlements_qs.filter(group_id=group_id)

        # Build currency-converted net balances
        net = defaultdict(Decimal)

        for expense in expenses_qs:
            paid_by_id = expense.paid_by_id
            exp_currency = expense.currency
            for split in expense.splits.all():
                if split.user_id == paid_by_id:
                    continue
                converted = Decimal(str(convert(float(split.amount), exp_currency, preferred, rates)))
                net[paid_by_id] += converted
                net[split.user_id] -= converted

        for s in settlements_qs:
            converted = Decimal(str(convert(float(s.amount), s.currency, preferred, rates)))
            net[s.receiver_id] -= converted
            net[s.payer_id] += converted

        net_filtered = {uid: amt for uid, amt in net.items() if abs(amt) > Decimal('0.01')}
        transactions = simplify_debts(net_filtered)

        all_ids = {uid for pair in transactions for uid in pair[:2]}
        users_map = {u.id: u for u in User.objects.filter(id__in=all_ids)}
        result = [
            {
                'from': UserBriefSerializer(users_map[debtor_id], context={'request': request}).data,
                'to': UserBriefSerializer(users_map[creditor_id], context={'request': request}).data,
                'amount': str(round(amount, 2)),
                'currency': preferred,
            }
            for debtor_id, creditor_id, amount in transactions
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
                group=group, splits__user=user
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
