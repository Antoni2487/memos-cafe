"""Reporte de tiempos: etapas, objetivo, horas, productos, meseros y
demoras, con tiempos puestos a mano para que las cuentas sean exactas."""

from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework.test import APIClient

from memos_cafe.caja.models import SolicitudCobro
from memos_cafe.caja.tests.factories import CajaFactory
from memos_cafe.caja.tests.factories import MesaFactory
from memos_cafe.mesas.models import Mesa
from memos_cafe.ordenes.models import Comanda
from memos_cafe.ordenes.services import OrdenService
from memos_cafe.productos.tests.factories import ProductoFactory
from memos_cafe.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

URL = "/api/reportes/tiempos/"


def _cliente(rol):
    usuario = UserFactory()
    usuario.groups.add(Group.objects.get_or_create(name=rol)[0])
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


def _comanda(mesero, producto, minutos, hora=12):
    """Una ronda de mesa con sus tiempos en minutos: (espera, preparación,
    servir); None = no llegó a esa etapa."""
    espera, prep, servir = minutos
    orden = OrdenService.crear_orden(
        usuario=mesero,
        tipo_orden="mesa",
        mesa=MesaFactory(estado=Mesa.Estado.LIBRE),
        detalles=[{"producto": producto, "cantidad": 1}],
    )
    llegada = timezone.localtime().replace(hour=hora, minute=0, second=0, microsecond=0)
    iniciada = llegada + timedelta(minutes=espera)
    lista = iniciada + timedelta(minutes=prep) if prep is not None else None
    entregada = (
        lista + timedelta(minutes=servir) if servir is not None and lista else None
    )
    Comanda.objects.filter(orden=orden).update(
        creada_en=llegada,
        iniciada_en=iniciada,
        lista_en=lista,
        entregada_en=entregada,
    )
    return orden


def _rango():
    hoy = timezone.localdate().isoformat()
    return {"fecha_inicio": hoy, "fecha_fin": hoy}


@pytest.fixture
def datos():
    CajaFactory()
    lucia = UserFactory(name="Lucía")
    pedro = UserFactory(name="Pedro")
    cafe = ProductoFactory(nombre="Café", precio=Decimal("6.00"))
    tostada = ProductoFactory(nombre="Tostada", precio=Decimal("16.00"))
    # Totales: 9, 12 y 30 minutos (dos a tiempo de tres).
    _comanda(lucia, cafe, (1, 5, 3), hora=9)
    _comanda(lucia, cafe, (2, 6, 4), hora=9)
    lenta = _comanda(pedro, tostada, (10, 15, 5), hora=13)
    # En preparación todavía: cuenta para la espera, no para el total.
    _comanda(pedro, cafe, (3, None, None), hora=13)
    SolicitudCobro.objects.create(
        orden=lenta,
        metodo_pago_sugerido="yape",
        atendido_en=timezone.now() + timedelta(minutes=4),
    )
    return lenta


def test_resume_etapas_total_y_objetivo(datos):
    r = _cliente("admin").get(URL, _rango())

    assert r.status_code == 200
    etapas = {e["clave"]: e for e in r.data["etapas"]}
    assert etapas["espera"]["n"] == 4
    assert etapas["espera"]["mediana"] == int(2.5 * 60)
    assert etapas["preparacion"]["mediana"] == 6 * 60
    assert etapas["servir"]["mediana"] == 4 * 60
    assert etapas["cobro"]["n"] == 1
    assert r.data["total"]["n"] == 3
    assert r.data["total"]["mediana"] == 12 * 60
    assert r.data["total"]["a_tiempo_pct"] == 67
    assert r.data["objetivo_min"] == 15


def test_por_hora_producto_mesero_y_demoras(datos):
    r = _cliente("admin").get(URL, _rango())

    assert [(h["hora"], h["comandas"]) for h in r.data["por_hora"]] == [(9, 2), (13, 1)]
    assert r.data["por_producto"][0] == {
        "nombre": "Tostada",
        "rondas": 1,
        "mediana_preparacion": 15 * 60,
    }
    meseros = {m["nombre"]: m["mediana_servir"] for m in r.data["por_mesero"]}
    assert meseros == {"Pedro": 5 * 60, "Lucía": int(3.5 * 60)}
    peor = r.data["demoras"][0]
    assert peor["total"] == 30 * 60
    assert peor["etapa_mas_larga"] == "Preparación"


def test_sin_datos_no_falla():
    r = _cliente("admin").get(URL, _rango())

    assert r.status_code == 200
    assert r.data["total"] == {
        "mediana": None,
        "p90": None,
        "n": 0,
        "a_tiempo_pct": None,
    }
    assert r.data["demoras"] == []


def test_solo_el_admin(datos):
    assert _cliente("mesero").get(URL, _rango()).status_code == 403
