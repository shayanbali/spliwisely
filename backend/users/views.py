from decimal import Decimal, InvalidOperation
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db import transaction as db_transaction
from .models import PushToken, CreditTransaction
from .serializers import RegisterSerializer, UserSerializer, CreditTransactionSerializer

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        current = request.data.get('current_password', '')
        new = request.data.get('new_password', '')
        confirm = request.data.get('confirm_password', '')

        if not request.user.check_password(current):
            return Response({'detail': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(new) < 8:
            return Response({'detail': 'New password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)
        if new != confirm:
            return Response({'detail': 'New passwords do not match.'}, status=status.HTTP_400_BAD_REQUEST)

        request.user.set_password(new)
        request.user.save()
        return Response({'detail': 'Password changed successfully.'})


class RegisterPushTokenView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        token = request.data.get('token', '').strip()
        if not token:
            return Response({'detail': 'Token required.'}, status=status.HTTP_400_BAD_REQUEST)
        PushToken.objects.get_or_create(user=request.user, token=token)
        return Response({'detail': 'Token registered.'})

    def delete(self, request):
        token = request.data.get('token', '').strip()
        PushToken.objects.filter(user=request.user, token=token).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CreditTransactionListView(generics.ListAPIView):
    serializer_class = CreditTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return CreditTransaction.objects.filter(user=self.request.user).select_related('counterpart')


class CreditTransferView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @db_transaction.atomic
    def post(self, request):
        to_user_id = request.data.get('to_user_id')
        raw_amount = request.data.get('amount')
        note = request.data.get('note', '').strip()
        currency = request.data.get('currency', 'USD')
        create_settlement = request.data.get('create_settlement', False)
        group_id = request.data.get('group_id')

        if not to_user_id:
            return Response({'detail': 'to_user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = Decimal(str(raw_amount))
        except (InvalidOperation, TypeError):
            return Response({'detail': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({'detail': 'Amount must be positive.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            to_user = User.objects.get(id=to_user_id)
        except User.DoesNotExist:
            return Response({'detail': 'Recipient not found.'}, status=status.HTTP_404_NOT_FOUND)

        from_user = User.objects.get(id=request.user.id)

        if from_user.id == to_user.id:
            return Response({'detail': 'Cannot transfer credits to yourself.'}, status=status.HTTP_400_BAD_REQUEST)

        if from_user.credits_balance < amount:
            return Response(
                {'detail': f'Insufficient credits. Balance: {from_user.credits_balance}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from_user.credits_balance -= amount
        to_user.credits_balance += amount
        from_user.save(update_fields=['credits_balance'])
        to_user.save(update_fields=['credits_balance'])

        CreditTransaction.objects.create(
            user=from_user, counterpart=to_user,
            transaction_type='transfer_out', amount=amount, currency=currency, note=note,
        )
        CreditTransaction.objects.create(
            user=to_user, counterpart=from_user,
            transaction_type='transfer_in', amount=amount, currency=currency, note=note,
        )

        if create_settlement:
            from expenses.models import Settlement
            settlement_note = ('Paid with Splitwise Credits' + (f' — {note}' if note else ''))
            Settlement.objects.create(
                payer=from_user, receiver=to_user,
                amount=amount, currency=currency,
                group_id=group_id or None,
                note=settlement_note,
            )

        return Response({
            'balance': str(from_user.credits_balance),
            'detail': 'Transfer successful.',
        })


class CreditTopUpDemoView(APIView):
    """Demo endpoint — adds credits without real payment. Amount capped at 500."""
    permission_classes = [permissions.IsAuthenticated]

    @db_transaction.atomic
    def post(self, request):
        raw = request.data.get('amount', '100')
        try:
            amount = Decimal(str(raw)).quantize(Decimal('0.01'))
        except (InvalidOperation, TypeError):
            amount = Decimal('100.00')
        amount = min(max(amount, Decimal('1')), Decimal('500'))
        user = User.objects.get(id=request.user.id)
        user.credits_balance += amount
        user.save(update_fields=['credits_balance'])
        CreditTransaction.objects.create(
            user=user, counterpart=None,
            transaction_type='topup', amount=amount, currency='USD',
            note=f'Demo top-up (+{amount} SC)',
        )
        return Response({'balance': str(user.credits_balance), 'detail': 'Top-up successful.'})
