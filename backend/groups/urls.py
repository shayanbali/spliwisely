from django.urls import path
from .views import GroupListCreateView, GroupDetailView, AddMemberView, RemoveMemberView, FriendListView, PotTransactionListCreateView, PotBalanceView

urlpatterns = [
    path('', GroupListCreateView.as_view(), name='group-list-create'),
    path('<int:pk>/', GroupDetailView.as_view(), name='group-detail'),
    path('<int:pk>/members/', AddMemberView.as_view(), name='group-add-member'),
    path('<int:pk>/members/<int:user_id>/', RemoveMemberView.as_view(), name='group-remove-member'),
    path('friends/', FriendListView.as_view(), name='friend-list'),
    path('<int:pk>/pot/', PotTransactionListCreateView.as_view(), name='pot-transactions'),
    path('<int:pk>/pot/balance/', PotBalanceView.as_view(), name='pot-balance'),
]
