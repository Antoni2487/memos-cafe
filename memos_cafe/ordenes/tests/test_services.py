from decimal import Decimal

import pytest

from memos_cafe.caja.tests.factories import CajaFactory
from memos_cafe.caja.tests.factories import MesaFactory
from memos_cafe.mesas.models import Mesa
from memos_cafe.ordenes.models import Orden
from memos_cafe.ordenes.services import OrdenService
from memos_cafe.productos.tests.factories import ProductoFactory
from memos_cafe.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


class TestOrdenServiceCrearOrdenOcupaMesa:
    def test_crear_orden_mesa_ocupa_la_mesa_en_la_misma_transaccion(self):
        """OrdenService.crear_orden debe dejar la mesa 'ocupada' apenas retorna,
        sin depender de ningun paso posterior (async, señal, polling, etc.)."""
        CajaFactory()
        usuario = UserFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        producto = ProductoFactory(precio=Decimal("10.00"))

        orden = OrdenService.crear_orden(
            usuario=usuario,
            tipo_orden="mesa",
            mesa=mesa,
            detalles=[{"producto": producto, "cantidad": 2}],
        )

        assert orden.mesa_id == mesa.id
        mesa.refresh_from_db()
        assert mesa.estado == Mesa.Estado.OCUPADA

    def test_crear_orden_llevar_no_toca_ninguna_mesa(self):
        """Ordenes para llevar no deben ocupar mesas: confirma que el efecto
        es especifico a tipo_orden='mesa', no un side-effect global."""
        CajaFactory()
        usuario = UserFactory()
        producto = ProductoFactory(precio=Decimal("10.00"))

        orden = OrdenService.crear_orden(
            usuario=usuario,
            tipo_orden="llevar",
            detalles=[{"producto": producto, "cantidad": 1}],
        )

        assert orden.mesa_id is None

    def test_crear_orden_sin_caja_abierta_lanza_error(self):
        # A proposito NO se crea CajaFactory(): ningun turno abierto.
        usuario = UserFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        producto = ProductoFactory(precio=Decimal("10.00"))

        with pytest.raises(ValueError, match="sesion de caja abierta"):
            OrdenService.crear_orden(
                usuario=usuario,
                tipo_orden="mesa",
                mesa=mesa,
                detalles=[{"producto": producto, "cantidad": 1}],
            )

    def test_crear_orden_en_mesa_con_pedido_abierto_lanza_error(self):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        producto = ProductoFactory(precio=Decimal("10.00"))
        datos = {
            "tipo_orden": "mesa",
            "mesa": mesa,
            "detalles": [{"producto": producto, "cantidad": 1}],
        }
        OrdenService.crear_orden(usuario=UserFactory(), **datos)

        with pytest.raises(ValueError, match="ya tiene un pedido en curso"):
            OrdenService.crear_orden(usuario=UserFactory(), **datos)

        assert Orden.objects.filter(mesa=mesa).count() == 1

    def test_mesa_ocupada_sin_pedido_admite_tomarle_el_pedido(self):
        """Se activó su QR (o quedó ocupada por un dato viejo) pero nadie
        pidió todavía: el mesero igual tiene que poder tomar el pedido."""
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.OCUPADA)

        orden = OrdenService.crear_orden(
            usuario=UserFactory(),
            tipo_orden="mesa",
            mesa=mesa,
            detalles=[{"producto": ProductoFactory(), "cantidad": 1}],
        )

        mesa.refresh_from_db()
        assert orden.estado == Orden.Estado.ABIERTA
        assert mesa.estado == Mesa.Estado.OCUPADA
