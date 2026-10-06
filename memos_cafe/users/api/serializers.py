from django.contrib.auth.models import Group
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from memos_cafe.roles.models import ROLES
from memos_cafe.users.models import User


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=False,
        min_length=8,
        max_length=128,
    )
    group_name = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True,
        max_length=150,
    )
    groups = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "name",
            "password",
            "group_name",
            "is_active",
            "date_joined",
            "groups",
        ]
        read_only_fields = ["id", "date_joined"]

    def validate_group_name(self, value):
        """Solo los roles del sistema (admin, cajero, mesero, cocina). Antes un
        nombre que no existía creaba el usuario sin rol, sin avisar."""
        if value and value not in dict(ROLES):
            roles = ", ".join(dict(ROLES))
            msg = f"Rol inválido. Usa uno de: {roles}."
            raise serializers.ValidationError(msg)
        return value

    def get_groups(self, obj):
        return [{"id": g.id, "name": g.name} for g in obj.groups.all()]

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        group_name = validated_data.pop("group_name", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        if group_name:
            # get_or_create: el grupo puede no existir aún en una base nueva.
            user.groups.add(Group.objects.get_or_create(name=group_name)[0])
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        validated_data.pop("group_name", None)  # lo maneja el view
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user: User):
        token = super().get_token(user)
        token["email"] = user.email
        token["nombre"] = user.name or user.email
        token["roles"] = list(user.groups.values_list("name", flat=True))
        return token
