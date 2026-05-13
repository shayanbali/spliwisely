from django.urls import path
from .views import (
    RegisterView, MeView, ChangePasswordView, RegisterPushTokenView,
    CreditTransactionListView, CreditTransferView, CreditTopUpDemoView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('me/', MeView.as_view(), name='me'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
    path('push-token/', RegisterPushTokenView.as_view(), name='push-token'),
    path('credits/transactions/', CreditTransactionListView.as_view(), name='credit-transactions'),
    path('credits/transfer/', CreditTransferView.as_view(), name='credit-transfer'),
    path('credits/topup-demo/', CreditTopUpDemoView.as_view(), name='credit-topup-demo'),
]
