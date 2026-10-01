from decimal import Decimal

import pytest
from django.core.management import call_command

from memos_cafe.caja.models import SolicitudCobro
from memos_cafe.caja.tests.factories import CajaFactory
from memos_cafe.caja.tests.factories import MesaFactory
from memos_cafe.mesas.models import Mesa
from memos_cafe.ordenes.models import Orden
from memos_cafe.ordenes.services import OrdenService
from memos_cafe.productos.tests.factories import ProductoFactory
from memos_cafe.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


def _orden_de_mesa():
    CajaFactory()
    producto = ProductoFactory(precio=Decimal("10.00"))
    return OrdenService.crear_orden(
        usuario=UserFactory(),
        tipo_orden="mesa",
        mesa=MesaFactory(estado=Mesa.Estado.LIBRE),
        detalles=[{"producto": producto, "cantidad": 1}],
    )


def test_sin_confirmar_no_cambia_nada():
    orden = _orden_de_mesa()

    call_command("liberar_salon")

    orden.refresh_from_db()
    assert orden.estado == Orden.Estado.ABIERTA
    assert orden.mesa.estado == Mesa.Estado.OCUPADA


def test_con_confirmar_anula_pedidos_y_libera_mesas():
    orden = _orden_de_mesa()
    SolicitudCobro.objects.create(orden=orden, metodo_pago_sugerido="yape")
    huerfana = MesaFactory(estado=Mesa.Estado.OCUPADA)  # ocupada sin pedido

    call_command("liberar_salon", "--confirmar")

    orden.refresh_from_db()
    huerfana.refresh_from_db()
    assert orden.estado == Orden.Estado.ANULADA
    assert orden.mesa.estado == Mesa.Estado.LIBRE
    assert huerfana.estado == Mesa.Estado.LIBRE
    assert not SolicitudCobro.objects.filter(atendido_en__isnull=True).exists()
