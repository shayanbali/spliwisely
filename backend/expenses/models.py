from django.db import models
from django.conf import settings
from django.utils import timezone
from groups.models import Group
import calendar

CURRENCY_CHOICES = [
    ('USD', 'USD'), ('EUR', 'EUR'), ('GBP', 'GBP'),
    ('CAD', 'CAD'), ('AUD', 'AUD'), ('JPY', 'JPY'),
    ('CHF', 'CHF'), ('CNY', 'CNY'), ('INR', 'INR'),
]

INTERVAL_CHOICES = [
    ('weekly', 'Weekly'),
    ('monthly', 'Monthly'),
    ('yearly', 'Yearly'),
]


def _advance_date(dt, interval):
    if interval == 'weekly':
        from datetime import timedelta
        return dt + timedelta(weeks=1)
    elif interval == 'monthly':
        year, month = (dt.year, dt.month + 1) if dt.month < 12 else (dt.year + 1, 1)
        day = min(dt.day, calendar.monthrange(year, month)[1])
        return dt.replace(year=year, month=month, day=day)
    elif interval == 'yearly':
        return dt.replace(year=dt.year + 1)
    return dt


class RecurringExpense(models.Model):
    SPLIT_CHOICES = [('equal', 'Equal'), ('exact', 'Exact'), ('percentage', 'Percentage')]

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='recurring_expenses')
    description = models.CharField(max_length=255)
    notes = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='USD')
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='recurring_paid'
    )
    split_type = models.CharField(max_length=10, choices=SPLIT_CHOICES, default='equal')
    participant_ids = models.JSONField(default=list)
    exact_amounts = models.JSONField(default=dict, blank=True)
    percentages = models.JSONField(default=dict, blank=True)
    interval = models.CharField(max_length=10, choices=INTERVAL_CHOICES, default='monthly')
    next_due = models.DateField()
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='created_recurring'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.description} ({self.interval})'

    def generate_next(self):
        """Create the next expense instance and advance next_due."""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        expense = Expense.objects.create(
            group=self.group,
            description=self.description,
            notes=self.notes,
            amount=self.amount,
            currency=self.currency,
            paid_by=self.paid_by,
            split_type=self.split_type,
            created_by=self.created_by,
            recurring=self,
        )

        participants = User.objects.filter(id__in=self.participant_ids)
        if self.split_type == 'equal':
            n = participants.count()
            if n:
                split_amount = round(float(self.amount) / n, 2)
                for user in participants:
                    ExpenseSplit.objects.create(expense=expense, user=user, amount=split_amount)
        elif self.split_type == 'exact':
            for user in participants:
                ExpenseSplit.objects.create(
                    expense=expense, user=user,
                    amount=self.exact_amounts.get(str(user.id), 0)
                )
        elif self.split_type == 'percentage':
            for user in participants:
                pct = float(self.percentages.get(str(user.id), 0))
                ExpenseSplit.objects.create(
                    expense=expense, user=user,
                    amount=round(float(self.amount) * pct / 100, 2)
                )

        self.next_due = _advance_date(self.next_due, self.interval)
        self.save(update_fields=['next_due'])
        return expense


class Expense(models.Model):
    SPLIT_CHOICES = [
        ('equal', 'Equal'),
        ('exact', 'Exact'),
        ('percentage', 'Percentage'),
    ]

    CATEGORY_CHOICES = [
        ('food',          'Food & Dining'),
        ('transport',     'Transport'),
        ('entertainment', 'Entertainment'),
        ('shopping',      'Shopping'),
        ('housing',       'Housing & Utilities'),
        ('health',        'Health & Fitness'),
        ('travel',        'Travel'),
        ('other',         'Other'),
    ]

    group = models.ForeignKey(
        Group, on_delete=models.CASCADE, related_name='expenses', null=True, blank=True
    )
    description = models.CharField(max_length=255)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='paid_expenses'
    )
    split_type = models.CharField(max_length=10, choices=SPLIT_CHOICES, default='equal')
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='USD')
    notes = models.TextField(blank=True)
    image = models.ImageField(upload_to='expenses/', blank=True, null=True)
    receipt_data = models.JSONField(null=True, blank=True)
    recurring = models.ForeignKey(
        'RecurringExpense', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='generated_expenses'
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='created_expenses'
    )
    STATUS_CHOICES = [
        ('approved', 'Approved'),
        ('pending',  'Pending Approval'),
        ('rejected', 'Rejected'),
    ]
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='approved')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.description} - {self.amount}'


class ExpenseApproval(models.Model):
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name='approvals')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='expense_approvals'
    )
    approved = models.BooleanField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('expense', 'user')

    def __str__(self):
        return f'{self.user} {"✓" if self.approved else "✗"} {self.expense}'


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
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='USD')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.payer} paid {self.receiver} {self.amount}'
