from django.db import models
from django.conf import settings
from groups.models import Group


class Expense(models.Model):
    SPLIT_CHOICES = [
        ('equal', 'Equal'),
        ('exact', 'Exact'),
        ('percentage', 'Percentage'),
    ]

    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name='expenses', null=True, blank=True
    )
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='paid_expenses'
    )
    split_type = models.CharField(max_length=10, choices=SPLIT_CHOICES, default='equal')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='created_expenses'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.description} - {self.amount}'


class ExpenseSplit(models.Model):
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name='splits')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='expense_splits'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = ('expense', 'user')

    def __str__(self):
        return f'{self.user} owes {self.amount} for {self.expense}'


class Settlement(models.Model):
    payer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='settlements_paid'
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='settlements_received'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    group = models.ForeignKey(
        Group, on_delete=models.SET_NULL, null=True, blank=True, related_name='settlements'
    )
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.payer} paid {self.receiver} {self.amount}'
