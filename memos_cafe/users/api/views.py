import contextlib
import logging

from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import APIException
from rest_framework.mixins import CreateModelMixin
from rest_framework.mixins import DestroyModelMixin
from rest_framework.mixins import ListModelMixin
from rest_framework.mixins import RetrieveModelMixin
from rest_framework.mixins import UpdateModelMixin
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.viewsets import GenericViewSet
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenBlacklistView
from rest_framework_simplejwt.views import TokenObtainPairView

from memos_cafe.users.api.serializers import CustomTokenObtainPairSerializer
from memos_cafe.users.api.serializers import UserSerializer
from memos_cafe.users.models import User
from memos_cafe.utils.permissions import EsAdmin
from memos_cafe.utils.permissions import TodosAutenticados

logger = logging.getLogger("memos_cafe.auth")


class LoginRateThrottle(AnonRateThrottle):
    """Máximo 5 intentos de login por minuto por IP."""

    rate = "5/minute"
    scope = "login"


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_classes = [LoginRateThrottle]

    def post(self, request, *args, **kwargs):
        email_intento = request.data.get("email", "")
        serializer = self.get_serializer(data=request.data)
        try:
            serializer.is_valid(raise_exception=True)
        except APIException:
            # Fallo de input / intento de login invalido -- no se distingue
            # "usuario no existe" de "password incorrecta" en la respuesta
            # (evita enumeracion de usuarios), pero si en el log interno.
            logger.warning(
                "Login FALLIDO | email=%s | ip=%s",
                email_intento,
                request.META.get("REMOTE_ADDR"),
            )
            return Response(
                {"detail": "Credenciales inválidas."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user = serializer.user
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])
        logger.info(
            "Login exitoso | usuario=%s | ip=%s",
            user.email,
            request.META.get("REMOTE_ADDR"),
        )
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class CustomTokenBlacklistView(TokenBlacklistView):
    """POST /api/auth/logout/ — invalida el refresh token y deja registro
    del cierre de sesion (quien, cuando).

    TokenBlacklistView no exige un access token valido (solo necesita el
    refresh en el body), asi que request.user siempre es anonimo aca --
    el usuario se identifica decodificando el propio refresh token."""

    def post(self, request, *args, **kwargs):
        # Se decodifica el refresh ANTES de blacklistearlo -- una vez que
        # super().post() lo invalida, reconstruir RefreshToken(...) desde
        # el mismo string lanza TokenError("Token is blacklisted").
        usuario = "desconocido"
        # Token ausente, vencido o de un usuario borrado: solo cambia el log.
        with contextlib.suppress(TokenError, User.DoesNotExist, KeyError, TypeError):
            token = RefreshToken(request.data.get("refresh"))
            usuario = User.objects.get(pk=token["user_id"]).email

        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            logger.info(
                "Logout | usuario=%s | ip=%s",
                usuario,
                request.META.get("REMOTE_ADDR"),
            )
        return response


class UserViewSet(
    CreateModelMixin,
    RetrieveModelMixin,
    ListModelMixin,
    UpdateModelMixin,
    DestroyModelMixin,
    GenericViewSet,
):
    serializer_class = UserSerializer
    queryset = User.objects.all().order_by("id")
    lookup_field = "pk"

    def get_permissions(self):
        if self.action in [
            "create",
            "destroy",
            "list",
            "update",
            "partial_update",
            "toggle_activo",
        ]:
            return [EsAdmin()]
        return [TodosAutenticados()]

    def get_queryset(self, *args, **kwargs):
        if not self.request.user.is_authenticated:
            return User.objects.none()
        if self.request.user.groups.filter(name="admin").exists():
            return User.objects.prefetch_related("groups").all().order_by("id")
        return User.objects.filter(id=self.request.user.id).order_by("id")

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # group_name ya pasó por UserSerializer.validate_group_name.
        group_name = serializer.validated_data.get("group_name")
        if group_name is not None:
            instance.groups.clear()
            if group_name:
                instance.groups.add(Group.objects.get_or_create(name=group_name)[0])

        instance.refresh_from_db()
        return Response(self.get_serializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.id == request.user.id:
            return Response(
                {"detail": "No puedes eliminar tu propia cuenta."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"], url_path="toggle-activo")
    def toggle_activo(self, request, pk=None):
        """POST /api/users/{id}/toggle-activo/ — activa o desactiva un usuario."""
        instance = self.get_object()
        if instance.id == request.user.id:
            return Response(
                {"detail": "No puedes desactivar tu propia cuenta."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance.is_active = not instance.is_active
        instance.save(update_fields=["is_active"])
        return Response(self.get_serializer(instance).data)

    @action(detail=False, methods=["get"])
    def me(self, request):
        """GET /api/users/me/ — perfil del usuario autenticado."""
        serializer = UserSerializer(request.user, context={"request": request})
        return Response(status=status.HTTP_200_OK, data=serializer.data)
