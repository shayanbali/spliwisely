from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from decimal import Decimal
from .models import Group, GroupMember, Friendship, PotTransaction
from .serializers import GroupSerializer, AddMemberSerializer, FriendshipSerializer, PotTransactionSerializer


class GroupListCreateView(generics.ListCreateAPIView):
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Group.objects.filter(members__user=self.request.user)


class GroupDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Group.objects.filter(members__user=self.request.user)


class AddMemberView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        group = get_object_or_404(Group, pk=pk, members__user=request.user)
        serializer = AddMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['email']
        member, created = GroupMember.objects.get_or_create(group=group, user=user)
        if not created:
            return Response({'detail': 'User is already a member.'}, status=status.HTTP_400_BAD_REQUEST)
        Friendship.objects.get_or_create(from_user=request.user, to_user=user)
        Friendship.objects.get_or_create(from_user=user, to_user=request.user)
        return Response({'detail': 'Member added.'}, status=status.HTTP_201_CREATED)


class RemoveMemberView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk, user_id):
        group = get_object_or_404(Group, pk=pk, members__user=request.user)
        member = get_object_or_404(GroupMember, group=group, user_id=user_id)
        member.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FriendListView(generics.ListAPIView):
    serializer_class = FriendshipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Friendship.objects.filter(from_user=self.request.user).select_related('to_user')


class PotTransactionListCreateView(generics.ListCreateAPIView):
    serializer_class = PotTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_group(self):
        return get_object_or_404(Group, pk=self.kwargs['pk'], members__user=self.request.user)

    def get_queryset(self):
        return PotTransaction.objects.filter(
            group=self.get_group()
        ).select_related('user').order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(group=self.get_group())


class PotBalanceView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        group = get_object_or_404(Group, pk=pk, members__user=request.user)
        transactions = PotTransaction.objects.filter(group=group)
        total = Decimal('0')
        for t in transactions:
            if t.transaction_type == PotTransaction.CONTRIBUTION:
                total += t.amount
            else:
                total -= t.amount
        return Response({
            'balance': str(round(total, 2)),
            'currency': group.currency,
        })
