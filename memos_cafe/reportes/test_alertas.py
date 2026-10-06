from decimal import Decimal

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from memos_cafe.caja.tests.factories import CajaFactory
from memos_cafe.caja.tests.factories import MesaFactory
from memos_cafe.mesas.ayudas_pruebas import atender_mesa_por_qr
from memos_cafe.mesas.models import Mesa
from memos_cafe.mesas.services import SesionMesaService
from memos_cafe.ordenes.services import OrdenService
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
    atender_mesa_por_qr(mesa, mesero)
    SesionMesaService.solicitar_cobro(mesa, metodo_pago_sugerido="yape")

    r = admin_client.get("/api/alertas/")

    assert r.status_code == 200
    tipos = [a["tipo"] for a in r.data]
    assert "solicitud_cobro" in tipos
    mensaje = next(a["mensaje"] for a in r.data if a["tipo"] == "solicitud_cobro")
    assert "Mesa 42" in mensaje
    assert "Yape" in mensaje


def test_el_admin_se_entera_en_una_linea_de_lo_atendido(admin_client):
    """El admin no recibe los avisos de trabajo de los meseros; la campana
    le dice qué mesa se atendió, quién la tomó y qué se cobró."""
    CajaFactory()
    mesero = UserFactory(name="Tatiana Montenegro")
    producto = ProductoFactory(precio=Decimal("10.00"))
    mesa = MesaFactory(estado=Mesa.Estado.LIBRE, numero=7)
    OrdenService.crear_orden(
        usuario=mesero,
        tipo_orden="mesa",
        mesa=mesa,
        detalles=[{"producto": producto, "cantidad": 1}],
    )
    OrdenService.crear_orden(
        usuario=mesero,
        tipo_orden="llevar",
        cliente_nombre="Ana",
        detalles=[{"producto": producto, "cantidad": 1}],
    )

    mensajes = [a["mensaje"] for a in admin_client.get("/api/alertas/").data]

    assert "Mesa 7 atendida por Tatiana Montenegro" in mensajes
    assert "Pedido para llevar de Ana tomado por Tatiana Montenegro" in mensajes
