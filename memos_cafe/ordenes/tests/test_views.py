from decimal import Decimal

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from memos_cafe.caja.tests.factories import CajaFactory
from memos_cafe.caja.tests.factories import MesaFactory
from memos_cafe.mesas.models import Mesa
from memos_cafe.ordenes.services import OrdenService
from memos_cafe.productos.tests.factories import ProductoFactory
from memos_cafe.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def mesero_client():
    grupo, _ = Group.objects.get_or_create(name="mesero")
    usuario = UserFactory()
    usuario.groups.add(grupo)
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


@pytest.fixture
def cajero_client():
    grupo, _ = Group.objects.get_or_create(name="cajero")
    usuario = UserFactory()
    usuario.groups.add(grupo)
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


@pytest.fixture
def cocina_client():
    grupo, _ = Group.objects.get_or_create(name="cocina")
    usuario = UserFactory()
    usuario.groups.add(grupo)
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


class TestOrdenViewSetQuerysetCajero:
    """Cubre OrdenViewSet.get_queryset() para el rol cajero — la rama que
    se toco al mover la consulta de la caja abierta a OrdenService
    (para que la vista no importe memos_cafe.caja.models directamente,
    ver .importlinter)."""

    def test_cajero_ve_ordenes_del_turno_actual(self, cajero_client):
        CajaFactory()  # turno abierto "ahora"
        mesero = UserFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        producto = ProductoFactory(precio=Decimal("10.00"))
        OrdenService.crear_orden(
            usuario=mesero,
            tipo_orden="mesa",
            mesa=mesa,
            detalles=[{"producto": producto, "cantidad": 1}],
        )

        r = cajero_client.get("/api/ordenes/")

        assert r.status_code == 200
        listado = r.data.get("results", r.data)
        assert len(listado) == 1

    def test_cajero_sin_turno_abierto_no_ve_ordenes(self, cajero_client):
        # A proposito NO se crea CajaFactory(): ningun turno abierto.
        r = cajero_client.get("/api/ordenes/")

        assert r.status_code == 200
        listado = r.data.get("results", r.data)
        assert listado == []


class TestCrearOrdenReflejaMesaOcupadaSinPolling:
    def test_post_ordenes_crear_luego_get_mesas_ya_refleja_ocupada(self, mesero_client):
        """Tras el POST de creacion, un GET /mesas/ inmediato (sin sleep ni
        reintentos) debe devolver la mesa como 'ocupada'. Cubre el flujo
        completo end-to-end que el frontend consume."""
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        producto = ProductoFactory(precio=Decimal("10.00"))

        r_crear = mesero_client.post(
            "/api/ordenes/crear/",
            {
                "tipo_orden": "mesa",
                "mesa": mesa.id,
                "detalles": [{"producto": producto.id, "cantidad": 1}],
            },
            format="json",
        )
        assert r_crear.status_code == 201
        assert r_crear.data["mesa"] == mesa.id

        r_mesas = mesero_client.get("/api/mesas/")
        assert r_mesas.status_code == 200
        listado = r_mesas.data.get("results", r_mesas.data)
        mesa_en_respuesta = next(m for m in listado if m["id"] == mesa.id)
        assert mesa_en_respuesta["estado"] == "ocupada"

    def test_post_ordenes_crear_con_mesa_ya_ocupada_rechaza(self, mesero_client):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        producto = ProductoFactory(precio=Decimal("10.00"))
        OrdenService.crear_orden(
            usuario=UserFactory(),
            tipo_orden="mesa",
            mesa=mesa,
            detalles=[{"producto": producto, "cantidad": 1}],
        )

        r_crear = mesero_client.post(
            "/api/ordenes/crear/",
            {
                "tipo_orden": "mesa",
                "mesa": mesa.id,
                "detalles": [{"producto": producto.id, "cantidad": 1}],
            },
            format="json",
        )
        assert r_crear.status_code == 400


class TestTableroCocina:
    """GET /api/ordenes/cocina/ y PATCH .../estado-preparacion/ — tablero
    de Cocina y avance de estado de un item."""

    def _crear_orden_con_item(self):
        CajaFactory()
        mesero = UserFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        producto = ProductoFactory(precio=Decimal("10.00"))
        return OrdenService.crear_orden(
            usuario=mesero,
            tipo_orden="mesa",
            mesa=mesa,
            detalles=[{"producto": producto, "cantidad": 2}],
        )

    def test_cocina_ve_tickets_con_items_pendientes(self, cocina_client):
        orden = self._crear_orden_con_item()

        r = cocina_client.get("/api/ordenes/cocina/")

        assert r.status_code == 200
        assert len(r.data) == 1
        assert r.data[0]["id"] == orden.id
        assert r.data[0]["mesa_numero"] == orden.mesa.numero
        assert len(r.data[0]["detalles"]) == 1
        assert r.data[0]["detalles"][0]["estado_preparacion"] == "pendiente"
        # serializer liviano: no expone precios ni datos de cliente
        assert "total" not in r.data[0]
        assert "precio_unitario" not in r.data[0]["detalles"][0]

    def test_cocina_no_ve_items_ya_entregados(self, cocina_client):
        orden = self._crear_orden_con_item()
        detalle = orden.detalles.first()
        detalle.estado_preparacion = "entregado"
        detalle.save(update_fields=["estado_preparacion"])

        r = cocina_client.get("/api/ordenes/cocina/")

        assert r.status_code == 200
        assert r.data == []

    def test_mesero_no_puede_ver_tablero_de_cocina(self, mesero_client):
        self._crear_orden_con_item()

        r = mesero_client.get("/api/ordenes/cocina/")

        assert r.status_code == 403

    def test_cocina_avanza_estado_de_un_item(self, cocina_client):
        orden = self._crear_orden_con_item()
        detalle = orden.detalles.first()

        r = cocina_client.patch(
            f"/api/ordenes/{orden.id}/detalles/{detalle.id}/estado-preparacion/",
            {"estado_preparacion": "en_preparacion"},
            format="json",
        )

        assert r.status_code == 200
        detalle.refresh_from_db()
        assert detalle.estado_preparacion == "en_preparacion"

    def test_cocina_no_puede_saltar_estados(self, cocina_client):
        orden = self._crear_orden_con_item()
        detalle = orden.detalles.first()

        r = cocina_client.patch(
            f"/api/ordenes/{orden.id}/detalles/{detalle.id}/estado-preparacion/",
            {"estado_preparacion": "listo"},
            format="json",
        )

        assert r.status_code == 400
        detalle.refresh_from_db()
        assert detalle.estado_preparacion == "pendiente"

    def test_mesero_no_hace_las_transiciones_de_cocina_en_ordenes_ajenas(
        self,
        mesero_client,
    ):
        """El mesero ve las órdenes abiertas de otros (para sumarles una
        ronda o servir lo que está listo), pero igual no puede hacer las
        transiciones de Cocina sobre ellas."""
        orden = self._crear_orden_con_item()
        detalle = orden.detalles.first()

        r = mesero_client.patch(
            f"/api/ordenes/{orden.id}/detalles/{detalle.id}/estado-preparacion/",
            {"estado_preparacion": "en_preparacion"},
            format="json",
        )

        assert r.status_code == 403
        detalle.refresh_from_db()
        assert detalle.estado_preparacion == "pendiente"


class TestMeseroMarcaEntregado:
    """El mesero solo puede avanzar un item hasta 'entregado' (retirarlo
    de la mesa una vez que Cocina lo dejó listo) — nunca las transiciones
    que le corresponden a Cocina."""

    def _crear_orden_de(self, mesero):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        producto = ProductoFactory(precio=Decimal("10.00"))
        return OrdenService.crear_orden(
            usuario=mesero,
            tipo_orden="mesa",
            mesa=mesa,
            detalles=[{"producto": producto, "cantidad": 1}],
        )

    def _cliente_de(self, usuario):
        client = APIClient()
        client.force_authenticate(user=usuario)
        return client

    def test_mesero_marca_entregado_un_item_listo_de_su_propia_orden(self):
        grupo, _ = Group.objects.get_or_create(name="mesero")
        mesero = UserFactory()
        mesero.groups.add(grupo)
        orden = self._crear_orden_de(mesero)
        detalle = orden.detalles.first()
        detalle.estado_preparacion = "listo"
        detalle.save(update_fields=["estado_preparacion"])

        r = self._cliente_de(mesero).patch(
            f"/api/ordenes/{orden.id}/detalles/{detalle.id}/estado-preparacion/",
            {"estado_preparacion": "entregado"},
            format="json",
        )

        assert r.status_code == 200
        detalle.refresh_from_db()
        assert detalle.estado_preparacion == "entregado"

    def test_mesero_no_puede_saltarse_a_cocina(self):
        grupo, _ = Group.objects.get_or_create(name="mesero")
        mesero = UserFactory()
        mesero.groups.add(grupo)
        orden = self._crear_orden_de(mesero)
        detalle = orden.detalles.first()

        r = self._cliente_de(mesero).patch(
            f"/api/ordenes/{orden.id}/detalles/{detalle.id}/estado-preparacion/",
            {"estado_preparacion": "en_preparacion"},
            format="json",
        )

        assert r.status_code == 403
        detalle.refresh_from_db()
        assert detalle.estado_preparacion == "pendiente"

    def test_cajero_no_puede_marcar_entregado(self, cajero_client):
        orden = self._crear_orden_de(UserFactory())
        detalle = orden.detalles.first()
        detalle.estado_preparacion = "listo"
        detalle.save(update_fields=["estado_preparacion"])

        r = cajero_client.patch(
            f"/api/ordenes/{orden.id}/detalles/{detalle.id}/estado-preparacion/",
            {"estado_preparacion": "entregado"},
            format="json",
        )

        assert r.status_code == 403

    def test_cocina_sigue_pudiendo_cualquier_transicion_valida(self, cocina_client):
        orden = self._crear_orden_de(UserFactory())
        detalle = orden.detalles.first()

        r = cocina_client.patch(
            f"/api/ordenes/{orden.id}/detalles/{detalle.id}/estado-preparacion/",
            {"estado_preparacion": "en_preparacion"},
            format="json",
        )

        assert r.status_code == 200
