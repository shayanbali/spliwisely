from rest_framework import serializers
from django.contrib.auth import get_user_model
from groups.serializers import UserBriefSerializer
from .models import Expense, ExpenseSplit, Settlement, RecurringExpense

User = get_user_model()


class ExpenseSplitSerializer(serializers.ModelSerializer):
    user = UserBriefSerializer(read_only=True)

    class Meta:
        model = ExpenseSplit
        fields = ('id', 'user', 'amount')


class ExpenseSerializer(serializers.ModelSerializer):
    splits = ExpenseSplitSerializer(many=True, read_only=True)
    paid_by = UserBriefSerializer(read_only=True)
    paid_by_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='paid_by', write_only=True
    )
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True
    )
    exact_amounts = serializers.DictField(
        child=serializers.DecimalField(max_digits=10, decimal_places=2),
        write_only=True, required=False
    )
    percentages = serializers.DictField(
        child=serializers.DecimalField(max_digits=5, decimal_places=2),
        write_only=True, required=False
    )

    class Meta:
        model = Expense
        fields = (
            'id', 'group', 'description', 'notes', 'image', 'receipt_data', 'amount', 'currency',
            'paid_by', 'paid_by_id', 'split_type', 'splits', 'participant_ids', 'exact_amounts',
            'percentages', 'recurring', 'created_at',
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if data.get('image'):
            data['image'] = request.build_absolute_uri(instance.image.url) if request else instance.image.url
        return data

    def validate(self, data):
        # On partial updates (e.g. image-only PATCH), skip split validation entirely
        # if participant_ids wasn't included in the request.
        if 'participant_ids' not in data:
            return data

        participant_ids = data['participant_ids']
        if not participant_ids:
            raise serializers.ValidationError('At least one participant is required.')

        split_type = data.get('split_type', getattr(self.instance, 'split_type', 'equal'))
        amount = data.get('amount', getattr(self.instance, 'amount', None))

        if split_type == 'exact' and amount is not None:
            exact_amounts = data.get('exact_amounts', {})
            total = sum(exact_amounts.values())
            if round(float(total), 2) != round(float(amount), 2):
                raise serializers.ValidationError('Exact amounts must sum to the total expense amount.')

        if split_type == 'percentage':
            percentages = data.get('percentages', {})
            total = sum(percentages.values())
            if round(float(total), 2) != 100.0:
                raise serializers.ValidationError('Percentages must sum to 100.')

        return data

    def create(self, validated_data):
        participant_ids = validated_data.pop('participant_ids')
        exact_amounts = validated_data.pop('exact_amounts', {})
        percentages = validated_data.pop('percentages', {})
        split_type = validated_data.get('split_type', 'equal')
        amount = validated_data['amount']

        expense = Expense.objects.create(
            created_by=self.context['request'].user,
            **validated_data
        )

        participants = User.objects.filter(id__in=participant_ids)

        if split_type == 'equal':
            split_amount = round(float(amount) / len(participants), 2)
            for user in participants:
                ExpenseSplit.objects.create(expense=expense, user=user, amount=split_amount)

        elif split_type == 'exact':
            for user in participants:
                split_amount = exact_amounts.get(str(user.id), 0)
                ExpenseSplit.objects.create(expense=expense, user=user, amount=split_amount)

        elif split_type == 'percentage':
            for user in participants:
                pct = float(percentages.get(str(user.id), 0))
                split_amount = round(float(amount) * pct / 100, 2)
                ExpenseSplit.objects.create(expense=expense, user=user, amount=split_amount)

        return expense

    def update(self, instance, validated_data):
        participant_ids = validated_data.pop('participant_ids', None)
        exact_amounts = validated_data.pop('exact_amounts', {})
        percentages = validated_data.pop('percentages', {})

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if participant_ids is not None:
            instance.splits.all().delete()
            split_type = instance.split_type
            amount = instance.amount
            participants = User.objects.filter(id__in=participant_ids)

            if split_type == 'equal':
                split_amount = round(float(amount) / len(participants), 2)
                for user in participants:
                    ExpenseSplit.objects.create(expense=instance, user=user, amount=split_amount)
            elif split_type == 'exact':
                for user in participants:
                    split_amount = exact_amounts.get(str(user.id), 0)
                    ExpenseSplit.objects.create(expense=instance, user=user, amount=split_amount)
            elif split_type == 'percentage':
                for user in participants:
                    pct = float(percentages.get(str(user.id), 0))
                    split_amount = round(float(amount) * pct / 100, 2)
                    ExpenseSplit.objects.create(expense=instance, user=user, amount=split_amount)

        return instance


class RecurringExpenseSerializer(serializers.ModelSerializer):
    paid_by = UserBriefSerializer(read_only=True)
    paid_by_id = serializers.PrimaryKeyRelatedField(
        queryset=get_user_model().objects.all(), source='paid_by', write_only=True
    )

    class Meta:
        model = RecurringExpense
        fields = (
            'id', 'group', 'description', 'notes', 'amount', 'currency',
            'paid_by', 'paid_by_id', 'split_type',
            'participant_ids', 'exact_amounts', 'percentages',
            'interval', 'next_due', 'is_active', 'created_at',
        )
        read_only_fields = ('next_due', 'created_at')

    def create(self, validated_data):
        from datetime import date
        validated_data['next_due'] = date.today()
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class SettlementSerializer(serializers.ModelSerializer):
    payer = UserBriefSerializer(read_only=True)
    receiver = UserBriefSerializer(read_only=True)
    payer_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='payer', write_only=True
    )
    receiver_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='receiver', write_only=True
    )

    class Meta:
        model = Settlement
        fields = ('id', 'payer', 'payer_id', 'receiver', 'receiver_id', 'amount', 'currency', 'group', 'note', 'created_at')
