from decimal import Decimal

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from memos_cafe.caja.tests.factories import CajaFactory
from memos_cafe.caja.tests.factories import MesaFactory
from memos_cafe.mesas.models import Mesa
from memos_cafe.mesas.services import SesionMesaService
from memos_cafe.productos.tests.factories import ProductoFactory
from memos_cafe.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_client():
    grupo, _ = Group.objects.get_or_create(name="admin")
    usuario = UserFactory()
    usuario.groups.add(grupo)
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


def test_solicitud_cobro_aparece_en_alertas(admin_client):
    """La solicitud de cobro del cliente por QR llega a la misma campanita
    de alertas que ya consume el frontend por polling — no abre un canal
    nuevo solo para esto."""
    CajaFactory()
    mesero_grupo, _ = Group.objects.get_or_create(name="mesero")
    mesero = UserFactory()
    mesero.groups.add(mesero_grupo)

    mesa = MesaFactory(estado=Mesa.Estado.LIBRE, numero=42)
    SesionMesaService.abrir_sesion(mesa, mesero=mesero)
    producto = ProductoFactory(precio=Decimal("10.00"))
    SesionMesaService.registrar_pedido(
        mesa,
        items=[{"producto": producto, "cantidad": 1}],
    )
    SesionMesaService.solicitar_cobro(mesa, metodo_pago_sugerido="yape")

    r = admin_client.get("/api/alertas/")

    assert r.status_code == 200
    tipos = [a["tipo"] for a in r.data]
    assert "solicitud_cobro" in tipos
    mensaje = next(a["mensaje"] for a in r.data if a["tipo"] == "solicitud_cobro")
    assert "Mesa 42" in mensaje
    assert "Yape" in mensaje
