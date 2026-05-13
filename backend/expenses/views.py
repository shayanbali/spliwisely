from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q
from decimal import Decimal
from django.contrib.auth import get_user_model
from groups.serializers import UserBriefSerializer
from groups.models import Group
from .models import Expense, ExpenseSplit, Settlement
from .serializers import ExpenseSerializer, SettlementSerializer
from .balance_engine import compute_net_balances, simplify_debts

User = get_user_model()


class ExpenseListCreateView(generics.ListCreateAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Expense.objects.filter(splits__user=self.request.user).distinct()
        group_id = self.request.query_params.get('group')
        if group_id:
            qs = qs.filter(group_id=group_id)
        return qs.select_related('paid_by', 'group').prefetch_related('splits__user')


class ExpenseDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Expense.objects.filter(splits__user=self.request.user).distinct()


class SettlementListCreateView(generics.ListCreateAPIView):
    serializer_class = SettlementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return Settlement.objects.filter(Q(payer=user) | Q(receiver=user))

    def perform_create(self, serializer):
        serializer.save()


class BalancesView(APIView):
    """Pairwise balances relative to the current user.
    Positive = other person owes you. Negative = you owe them.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        group_id = request.query_params.get('group')
        balances = {}

        expenses_qs = Expense.objects.filter(
            splits__user=user
        ).distinct().select_related('paid_by').prefetch_related('splits__user')

        if group_id:
            expenses_qs = expenses_qs.filter(group_id=group_id)

        for expense in expenses_qs:
            paid_by = expense.paid_by
            for split in expense.splits.all():
                if split.user == paid_by:
                    continue
                if paid_by == user:
                    # current user paid — split.user owes us
                    balances[split.user_id] = balances.get(split.user_id, Decimal('0')) + split.amount
                elif split.user == user:
                    # current user owes the payer
                    balances[paid_by.id] = balances.get(paid_by.id, Decimal('0')) - split.amount

        settlements_qs = Settlement.objects.filter(Q(payer=user) | Q(receiver=user))
        if group_id:
            settlements_qs = settlements_qs.filter(group_id=group_id)

        for s in settlements_qs:
            if s.payer == user:
                # we paid someone — reduces what we owe them
                balances[s.receiver_id] = balances.get(s.receiver_id, Decimal('0')) + s.amount
            else:
                # someone paid us — reduces what they owe us
                balances[s.payer_id] = balances.get(s.payer_id, Decimal('0')) - s.amount

        result = []
        for user_id, amount in balances.items():
            if amount == 0:
                continue
            other_user = User.objects.get(id=user_id)
            result.append({
                'user': UserBriefSerializer(other_user).data,
                'amount': str(amount),
            })

        return Response(result)


class SimplifiedBalancesView(APIView):
    """
    Minimum transactions needed to settle all debts in a group.
    Uses the greedy debt simplification algorithm.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        group_id = request.query_params.get('group')

        expenses_qs = Expense.objects.all().prefetch_related('splits')
        settlements_qs = Settlement.objects.all()

        if group_id:
            expenses_qs = expenses_qs.filter(group_id=group_id)
            settlements_qs = settlements_qs.filter(group_id=group_id)

        net_balances = compute_net_balances(expenses_qs, settlements_qs)
        transactions = simplify_debts(net_balances)

        result = []
        for debtor_id, creditor_id, amount in transactions:
            debtor = User.objects.get(id=debtor_id)
            creditor = User.objects.get(id=creditor_id)
            result.append({
                'from': UserBriefSerializer(debtor).data,
                'to': UserBriefSerializer(creditor).data,
                'amount': str(amount),
            })

        return Response(result)


class ActivityFeedView(APIView):
    """Combined, time-sorted feed of expenses and settlements for the current user."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        group_id = request.query_params.get('group')

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
            items.append({
                'type': 'expense',
                'id': e.id,
                'description': e.description,
                'amount': str(e.amount),
                'paid_by': UserBriefSerializer(e.paid_by).data,
                'group': e.group.name if e.group else None,
                'split_type': e.split_type,
                'my_share': my_share,
                'i_paid': i_paid,
                'created_at': e.created_at.isoformat(),
            })

        for s in settlements_qs:
            items.append({
                'type': 'settlement',
                'id': s.id,
                'amount': str(s.amount),
                'payer': UserBriefSerializer(s.payer).data,
                'receiver': UserBriefSerializer(s.receiver).data,
                'group': s.group.name if s.group else None,
                'note': s.note,
                'created_at': s.created_at.isoformat(),
            })

        items.sort(key=lambda x: x['created_at'], reverse=True)
        return Response(items)


class GroupBalancesView(APIView):
    """Returns each group's net balance for the current user."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
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
                for split in expense.splits.all():
                    if split.user == expense.paid_by:
                        continue
                    if expense.paid_by == user:
                        net_balance += split.amount
                    elif split.user == user:
                        net_balance -= split.amount

            for s in settlements_qs:
                if s.payer == user:
                    net_balance += s.amount
                else:
                    net_balance -= s.amount

            result.append({
                'group_id': group.id,
                'balance': str(net_balance),
            })

        return Response(result)
