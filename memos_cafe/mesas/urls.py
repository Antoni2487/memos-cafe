from django.urls import path
from rest_framework.routers import DefaultRouter

from memos_cafe.mesas.api.qr_views import MesaQREstadoView
from memos_cafe.mesas.api.qr_views import MesaQRPedidoView
from memos_cafe.mesas.api.qr_views import MesaQRSolicitarCobroView
from memos_cafe.mesas.api.views import MesaViewSet

router = DefaultRouter()
router.register("", MesaViewSet, basename="mesa")

# Van ANTES de router.urls: son rutas publicas explicitas bajo el mismo
# prefijo "mesas/" y deben resolverse antes que el patron {pk} generico
# del router (que si no, podria intentar interpretar "qr" como un pk).
urlpatterns = [
    path("qr/<slug:codigo>/", MesaQREstadoView.as_view(), name="mesa-qr-estado"),
    path("qr/<slug:codigo>/pedido/", MesaQRPedidoView.as_view(), name="mesa-qr-pedido"),
    path(
        "qr/<slug:codigo>/solicitar-cobro/",
        MesaQRSolicitarCobroView.as_view(),
        name="mesa-qr-solicitar-cobro",
    ),
    *router.urls,
]
