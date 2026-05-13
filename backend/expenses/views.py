from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Q
from decimal import Decimal
from .models import Expense, ExpenseSplit, Settlement
from .serializers import ExpenseSerializer, SettlementSerializer


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
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        group_id = request.query_params.get('group')
        balances = {}

        splits_qs = ExpenseSplit.objects.filter(
            expense__splits__user=user
        ).select_related('user', 'expense__paid_by')

        if group_id:
            splits_qs = splits_qs.filter(expense__group_id=group_id)

        for split in splits_qs:
            paid_by = split.expense.paid_by
            ower = split.user

            if paid_by == ower:
                continue

            if paid_by == user:
                # Someone owes us
                other_id = ower.id
                balances[other_id] = balances.get(other_id, Decimal('0')) + split.amount
            elif ower == user:
                # We owe someone
                other_id = paid_by.id
                balances[other_id] = balances.get(other_id, Decimal('0')) - split.amount

        # Apply settlements
        settlements_qs = Settlement.objects.filter(Q(payer=user) | Q(receiver=user))
        if group_id:
            settlements_qs = settlements_qs.filter(group_id=group_id)

        for s in settlements_qs:
            if s.payer == user:
                other_id = s.receiver_id
                balances[other_id] = balances.get(other_id, Decimal('0')) + s.amount
            else:
                other_id = s.payer_id
                balances[other_id] = balances.get(other_id, Decimal('0')) - s.amount

        from django.contrib.auth import get_user_model
        User = get_user_model()
        from groups.serializers import UserBriefSerializer

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
