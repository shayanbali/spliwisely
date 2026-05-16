from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Expense, Settlement
from users.notifications import send_push


@receiver(post_save, sender=Expense)
def notify_expense_created(sender, instance, created, **kwargs):
    if not created:
        return
    # Pending expenses notify via ExpenseVoteView / _notify_approval_needed instead
    if instance.status == 'pending':
        return
    participants = [s.user for s in instance.splits.select_related('user').all()
                    if s.user != instance.created_by]
    if not participants:
        return
    payer_name = instance.paid_by.name or instance.paid_by.email
    send_push(
        users=participants,
        title='New expense added',
        body=f'{payer_name} added "{instance.description}" — ${instance.amount}',
        data={'type': 'expense', 'id': instance.id, 'group_id': instance.group_id},
    )


@receiver(post_save, sender=Settlement)
def notify_settlement_created(sender, instance, created, **kwargs):
    if not created:
        return
    payer_name = instance.payer.name or instance.payer.email
    send_push(
        users=[instance.receiver],
        title='Payment received',
        body=f'{payer_name} paid you ${instance.amount}',
        data={'type': 'settlement', 'id': instance.id},
    )
