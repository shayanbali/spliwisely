from django.urls import path
from .views import RegisterView, MeView, RegisterPushTokenView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('me/', MeView.as_view(), name='me'),
    path('push-token/', RegisterPushTokenView.as_view(), name='push-token'),
]
