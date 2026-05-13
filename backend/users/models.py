from decimal import Decimal
from django.contrib.auth.models import AbstractUser
from django.db import models


CURRENCY_CHOICES = [
    ('USD', 'USD'), ('EUR', 'EUR'), ('GBP', 'GBP'),
    ('CAD', 'CAD'), ('AUD', 'AUD'), ('JPY', 'JPY'),
    ('CHF', 'CHF'), ('CNY', 'CNY'), ('INR', 'INR'),
]


class User(AbstractUser):
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=255, blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    preferred_currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='USD')
    credits_balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email


class PushToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_tokens')
    token = models.CharField(max_length=255, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.user} — {self.token[:30]}'


class CreditTransaction(models.Model):
    TYPE_CHOICES = [
        ('transfer_out', 'Transfer Out'),
        ('transfer_in', 'Transfer In'),
        ('topup', 'Top Up'),
    ]

    user = models.ForeignKey(User, related_name='credit_transactions', on_delete=models.CASCADE)
    counterpart = models.ForeignKey(
        User, related_name='credit_counterpart_txns',
        on_delete=models.SET_NULL, null=True, blank=True
    )
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user} {self.transaction_type} {self.amount}'
