"""
ASGI config for MemosCafe project.

Sirve HTTP (delegado a la app ASGI estandar de Django, que a su vez cubre
DRF) y WebSocket (cocina/meseros en tiempo real) desde el mismo proceso —
importante en un plan gratuito que solo da un proceso web (ver Render).

`get_asgi_application()` debe llamarse ANTES de importar cualquier codigo
de la app (routing/consumers/middleware) que toque modelos — es el mismo
motivo por el que Channels pide setup() temprano: los registros de apps
de Django todavia no estan listos si se importa antes.
"""

import os
import sys
from pathlib import Path

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

BASE_DIR = Path(__file__).resolve(strict=True).parent.parent
sys.path.append(str(BASE_DIR / "memos_cafe"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

django_asgi_app = get_asgi_application()

from memos_cafe.realtime.middleware import JWTAuthMiddlewareStack  # noqa: E402
from memos_cafe.realtime.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
    }
)
