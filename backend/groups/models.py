from django.db import models
from django.conf import settings


class Group(models.Model):
    CURRENCY_CHOICES = [
        ('USD', 'USD'), ('EUR', 'EUR'), ('GBP', 'GBP'),
        ('CAD', 'CAD'), ('AUD', 'AUD'), ('JPY', 'JPY'),
        ('CHF', 'CHF'), ('CNY', 'CNY'), ('INR', 'INR'),
    ]

    GROUP_TYPE_CHOICES = [('regular', 'Regular'), ('gaming', 'Gaming')]

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    currency = models.CharField(max_length=3, choices=CURRENCY_CHOICES, default='USD')
    image = models.ImageField(upload_to='group_images/', null=True, blank=True)
    simplify_debts = models.BooleanField(default=True)
    group_type = models.CharField(max_length=20, choices=GROUP_TYPE_CHOICES, default='regular')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='created_groups'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class GroupMember(models.Model):
    ROLE_CHOICES = [('admin', 'Admin'), ('member', 'Member')]

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='group_memberships'
    )
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='member')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('group', 'user')

    def __str__(self):
        return f'{self.user} in {self.group}'


class Friendship(models.Model):
    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='friendships_sent'
    )
    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='friendships_received'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('from_user', 'to_user')

    def __str__(self):
        return f'{self.from_user} → {self.to_user}'


class PotTransaction(models.Model):
    CONTRIBUTION = 'contribution'
    PAYOUT = 'payout'
    TYPE_CHOICES = [(CONTRIBUTION, 'Buy In'), (PAYOUT, 'Payout')]

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='pot_transactions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pot_transactions')
    transaction_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='USD')
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.user} {self.transaction_type} {self.amount} in {self.group}'
