from django.urls import path
from .views import ExpenseListCreateView, ExpenseDetailView, SettlementListCreateView, BalancesView

urlpatterns = [
    path('', ExpenseListCreateView.as_view(), name='expense-list-create'),
    path('<int:pk>/', ExpenseDetailView.as_view(), name='expense-detail'),
    path('settlements/', SettlementListCreateView.as_view(), name='settlement-list-create'),
    path('balances/', BalancesView.as_view(), name='balances'),
]
