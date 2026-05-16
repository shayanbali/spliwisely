from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import CreditTransaction

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    username = serializers.CharField(max_length=30)

    class Meta:
        model = User
        fields = ('id', 'email', 'name', 'username', 'password')

    def validate_username(self, value):
        value = value.strip().lower()
        if not value.replace('_', '').replace('.', '').isalnum():
            raise serializers.ValidationError('Username may only contain letters, numbers, underscores, and dots.')
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            name=validated_data.get('name', ''),
            password=validated_data['password'],
        )


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'name', 'username', 'avatar', 'preferred_currency', 'credits_balance')
        read_only_fields = ('id', 'email', 'credits_balance')

    def validate_username(self, value):
        value = value.strip().lower()
        if not value.replace('_', '').replace('.', '').isalnum():
            raise serializers.ValidationError('Username may only contain letters, numbers, underscores, and dots.')
        qs = User.objects.filter(username=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if data.get('avatar') and request:
            data['avatar'] = request.build_absolute_uri(instance.avatar.url)
        elif data.get('avatar'):
            data['avatar'] = instance.avatar.url
        return data


class CreditCounterpartSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'name', 'username', 'email', 'avatar')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if data.get('avatar') and request:
            data['avatar'] = request.build_absolute_uri(instance.avatar.url)
        elif data.get('avatar') and instance.avatar:
            data['avatar'] = instance.avatar.url
        return data


class CreditTransactionSerializer(serializers.ModelSerializer):
    counterpart = CreditCounterpartSerializer(read_only=True)

    class Meta:
        model = CreditTransaction
        fields = ('id', 'transaction_type', 'amount', 'currency', 'note', 'counterpart', 'created_at')
