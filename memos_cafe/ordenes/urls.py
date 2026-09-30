from rest_framework.routers import DefaultRouter
from rest_framework.routers import SimpleRouter

from memos_cafe.ordenes.api.views import ComandaViewSet
from memos_cafe.ordenes.api.views import OrdenViewSet

# Las comandas van en su propio router y ANTES que el de ordenes: el router
# de ordenes (prefijo vacio) tomaria "comandas" como si fuera el id de una
# orden.
comandas = SimpleRouter()
comandas.register("comandas", ComandaViewSet, basename="comanda")

router = DefaultRouter()
router.register("", OrdenViewSet, basename="orden")

urlpatterns = [*comandas.urls, *router.urls]
