from django.contrib import admin
from .models import Expense, ExpenseSplit, Settlement


@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ('description', 'amount', 'paid_by', 'split_type', 'group', 'created_at')


@admin.register(ExpenseSplit)
class ExpenseSplitAdmin(admin.ModelAdmin):
    list_display = ('expense', 'user', 'amount')


@admin.register(Settlement)
class SettlementAdmin(admin.ModelAdmin):
    list_display = ('payer', 'receiver', 'amount', 'group', 'created_at')
