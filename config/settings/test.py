"""
With these settings, tests run faster.
"""

from django.core.management.utils import get_random_secret_key

from .base import *  # noqa: F403
from .base import TEMPLATES
from .base import env

# GENERAL
# ------------------------------------------------------------------------------
# https://docs.djangoproject.com/en/dev/ref/settings/#secret-key
# Sin default fijo (ver config.settings.local para el mismo razonamiento):
# los tests no necesitan una firma estable entre corridas.
# El `or` va afuera de env() a proposito: si la clave generada empieza con
# "$", django-environ la toma como referencia a otra variable y entra en
# recursion infinita (RecursionError al azar al arrancar).
SECRET_KEY = env.str("DJANGO_SECRET_KEY", default="") or get_random_secret_key()
# https://docs.djangoproject.com/en/dev/ref/settings/#test-runner
TEST_RUNNER = "django.test.runner.DiscoverRunner"

# PASSWORDS
# ------------------------------------------------------------------------------
# https://docs.djangoproject.com/en/dev/ref/settings/#password-hashers
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# EMAIL
# ------------------------------------------------------------------------------
# https://docs.djangoproject.com/en/dev/ref/settings/#email-backend
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# DEBUGGING FOR TEMPLATES
# ------------------------------------------------------------------------------
TEMPLATES[0]["OPTIONS"]["debug"] = True  # type: ignore[index]

# MEDIA
# ------------------------------------------------------------------------------
# https://docs.djangoproject.com/en/dev/ref/settings/#media-url
MEDIA_URL = "http://media.testserver/"

# django-channels
# ------------------------------------------------------------------------------
# InMemoryChannelLayer en vez de Redis: los tests no deben depender de un
# Redis real corriendo, y no hace falta — un solo proceso de test no tiene
# el problema de "grupos distintos por worker" que si existe en produccion.
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}
# Your stuff...
# ------------------------------------------------------------------------------

# DRF — en tests lanzar excepciones en vez de redirigir
# ------------------------------------------------------------------------------
REST_FRAMEWORK = {
    **REST_FRAMEWORK,  # noqa: F405
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
}
