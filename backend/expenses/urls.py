from django.urls import path
from .views import (
    ExpenseListCreateView, ExpenseDetailView,
    SettlementListCreateView, BalancesView, SimplifiedBalancesView,
    ActivityFeedView, GroupBalancesView, ExchangeRatesView,
    RecurringExpenseListCreateView, RecurringExpenseDetailView, GenerateRecurringView,
    ScanReceiptView,
)

urlpatterns = [
    path('', ExpenseListCreateView.as_view(), name='expense-list-create'),
    path('<int:pk>/', ExpenseDetailView.as_view(), name='expense-detail'),
    path('settlements/', SettlementListCreateView.as_view(), name='settlement-list-create'),
    path('balances/', BalancesView.as_view(), name='balances'),
    path('balances/simplified/', SimplifiedBalancesView.as_view(), name='balances-simplified'),
    path('activity/', ActivityFeedView.as_view(), name='activity-feed'),
    path('group-balances/', GroupBalancesView.as_view(), name='group-balances'),
    path('rates/', ExchangeRatesView.as_view(), name='exchange-rates'),
    path('recurring/', RecurringExpenseListCreateView.as_view(), name='recurring-list-create'),
    path('recurring/<int:pk>/', RecurringExpenseDetailView.as_view(), name='recurring-detail'),
    path('recurring/generate/', GenerateRecurringView.as_view(), name='recurring-generate'),
    path('scan-receipt/', ScanReceiptView.as_view(), name='scan-receipt'),
]
