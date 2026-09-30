"""Autenticacion JWT para el handshake de WebSocket.

El proyecto es 100% JWT sin sesion de Django (ver REST_FRAMEWORK en
settings), asi que el AuthMiddlewareStack estandar de Channels (basado en
cookies de sesion) no sirve aca. Los navegadores tampoco permiten headers
custom (Authorization: Bearer ...) en el handshake WS nativo, asi que el
token viaja como query string: ws://host/ws/cocina/?token=<jwt>.
"""

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


@database_sync_to_async
def _usuario_desde_token(token_str):
    try:
        access_token = AccessToken(token_str)
        user_id = access_token["user_id"]
    except (InvalidToken, TokenError, KeyError):
        return AnonymousUser()

    user_model = get_user_model()
    try:
        return user_model.objects.get(pk=user_id)
    except user_model.DoesNotExist:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode()
        token = parse_qs(query_string).get("token", [None])[0]
        scope["user"] = await _usuario_desde_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):  # noqa: N802 -- como AuthMiddlewareStack de Channels
    return JWTAuthMiddleware(inner)
