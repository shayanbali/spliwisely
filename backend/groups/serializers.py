from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Group, GroupMember, Friendship, PotTransaction

User = get_user_model()


class UserBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'name', 'email', 'avatar')

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if data.get('avatar') and request:
            data['avatar'] = request.build_absolute_uri(instance.avatar.url)
        elif data.get('avatar'):
            data['avatar'] = instance.avatar.url
        return data


class GroupMemberSerializer(serializers.ModelSerializer):
    user = UserBriefSerializer(read_only=True)

    class Meta:
        model = GroupMember
        fields = ('id', 'user', 'role', 'joined_at')


class GroupSerializer(serializers.ModelSerializer):
    members = GroupMemberSerializer(many=True, read_only=True)
    created_by = UserBriefSerializer(read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = Group
        fields = ('id', 'name', 'description', 'currency', 'image', 'simplify_debts', 'group_type', 'created_by', 'members', 'member_count', 'created_at')

    def get_member_count(self, obj):
        return obj.members.count()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        if data.get('image'):
            data['image'] = request.build_absolute_uri(instance.image.url) if request else instance.image.url
        return data

    def create(self, validated_data):
        user = self.context['request'].user
        group = Group.objects.create(created_by=user, **validated_data)
        GroupMember.objects.create(group=group, user=user, role='admin')
        return group


class PotTransactionSerializer(serializers.ModelSerializer):
    user = UserBriefSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), source='user', write_only=True
    )

    class Meta:
        model = PotTransaction
        fields = ('id', 'user', 'user_id', 'transaction_type', 'amount', 'currency', 'note', 'created_at')
        read_only_fields = ('created_at',)


class AddMemberSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        try:
            return User.objects.get(email=value)
        except User.DoesNotExist:
            raise serializers.ValidationError('No user found with this email.')


class FriendshipSerializer(serializers.ModelSerializer):
    to_user = UserBriefSerializer(read_only=True)
    from_user = UserBriefSerializer(read_only=True)

    class Meta:
        model = Friendship
        fields = ('id', 'from_user', 'to_user', 'created_at')
