"""Ayudas para las pruebas del pedido por QR (no es un archivo de pruebas)."""

from decimal import Decimal

from memos_cafe.mesas.models import Mesa
from memos_cafe.mesas.services import SesionMesaService
from memos_cafe.ordenes.models import Orden
from memos_cafe.productos.tests.factories import ProductoFactory


def atender_mesa_por_qr(mesa: Mesa, mesero, items: list[dict] | None = None) -> Orden:
    """Deja la mesa atendida como en la vida real: el cliente pide por QR y
    un mesero confirma ese primer pedido. Devuelve la orden abierta."""
    items = items or [
        {"producto": ProductoFactory(precio=Decimal("10.00")), "cantidad": 1},
    ]
    pedido = SesionMesaService.registrar_pedido(mesa, items=items)
    return SesionMesaService.confirmar_pedido(pedido, mesero=mesero)
