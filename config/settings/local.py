from django.core.management.utils import get_random_secret_key

from .base import *  # noqa: F403
from .base import BASE_DIR
from .base import INSTALLED_APPS
from .base import MIDDLEWARE
from .base import env

# GENERAL
DEBUG = True
# Sin default fijo: una clave hardcodeada queda publicada en el historial
# de git para siempre. Si no se define DJANGO_SECRET_KEY, se genera una
# aleatoria en cada arranque -- invalida sesiones/JWT existentes al
# reiniciar el contenedor local, pero eso es aceptable en dev y no en
# produccion (config.settings.production exige la env var sin default).
# El `or` va afuera de env() a proposito: si la clave generada empieza con
# "$", django-environ la toma como referencia a otra variable y entra en
# recursion infinita (RecursionError al azar al arrancar).
SECRET_KEY = env.str("DJANGO_SECRET_KEY", default="") or get_random_secret_key()
ALLOWED_HOSTS = ["localhost", "0.0.0.0", "127.0.0.1"]  # noqa: S104

# CACHES
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "",
    },
}

# EMAIL
EMAIL_BACKEND = env(
    "DJANGO_EMAIL_BACKEND",
    default="django.core.mail.backends.console.EmailBackend",
)

# WhiteNoise
INSTALLED_APPS = ["whitenoise.runserver_nostatic", *INSTALLED_APPS]

# django-debug-toolbar
INSTALLED_APPS += ["debug_toolbar"]
MIDDLEWARE += ["debug_toolbar.middleware.DebugToolbarMiddleware"]
DEBUG_TOOLBAR_CONFIG = {
    "DISABLE_PANELS": [
        "debug_toolbar.panels.redirects.RedirectsPanel",
        "debug_toolbar.panels.profiling.ProfilingPanel",
    ],
    "SHOW_TEMPLATE_CONTEXT": True,
}
INTERNAL_IPS = ["127.0.0.1", "10.0.2.2"]
if env("USE_DOCKER") == "yes":
    import socket

    hostname, _, ips = socket.gethostbyname_ex(socket.gethostname())
    INTERNAL_IPS += [".".join([*ip.split(".")[:-1], "1"]) for ip in ips]
    RUNSERVERPLUS_POLLER_RELOADER_TYPE = "stat"
    RUNSERVERPLUS_POLLER_RELOADER_INTERVAL = 1

# django-extensions
INSTALLED_APPS += ["django_extensions"]

# CORS
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# ── Logging ──────────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {process:d} {thread:d} {message}",
            "style": "{",
        },
        "simple": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
        },
        "file": {
            "class": "logging.FileHandler",
            "filename": BASE_DIR / "logs" / "memos_cafe.log",
            "formatter": "verbose",
            "delay": True,
        },
    },
    "loggers": {
        "memos_cafe": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "memos_cafe.reportes": {
            "handlers": ["console", "file"],
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console", "file"],
            "level": "WARNING",
            "propagate": False,
        },
    },
}
