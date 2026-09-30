from django.urls import path
from rest_framework.routers import DefaultRouter
from rest_framework.routers import SimpleRouter

from memos_cafe.mesas.api.qr_views import MesaQREstadoView
from memos_cafe.mesas.api.qr_views import MesaQRPedidoView
from memos_cafe.mesas.api.qr_views import MesaQRSolicitarCobroView
from memos_cafe.mesas.api.views import MesaViewSet
from memos_cafe.mesas.api.views import PedidoPorConfirmarViewSet
from memos_cafe.mesas.api.views import PlanoView

# Antes que el router de mesas (prefijo vacio), que si no tomaria
# "pedidos-por-confirmar" como el id de una mesa. SimpleRouter para no
# agregar una segunda vista raiz que tape el listado de mesas.
por_confirmar = SimpleRouter()
por_confirmar.register(
    "pedidos-por-confirmar",
    PedidoPorConfirmarViewSet,
    basename="pedido-por-confirmar",
)

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
    path("plano/", PlanoView.as_view(), name="mesa-plano"),
    *por_confirmar.urls,
    *router.urls,
]
