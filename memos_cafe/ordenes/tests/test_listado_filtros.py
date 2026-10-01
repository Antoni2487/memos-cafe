from datetime import timedelta
from decimal import Decimal
from http import HTTPStatus

import pytest
from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework.test import APIClient

from memos_cafe.caja.tests.factories import OrdenFactory
from memos_cafe.ordenes.models import Orden
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


def _crear(estado, hace=timedelta(0)):
    orden = OrdenFactory(estado=estado, total=Decimal("10.00"))
    Orden.objects.filter(pk=orden.pk).update(fecha_creacion=timezone.now() - hace)
    return orden


def test_admin_ve_solo_las_ordenes_de_hoy(admin_client):
    """Las cerradas de otro día van al historial (?fecha=); las abiertas de
    otro día sí se ven (ver test_comandas, para poder cobrarlas)."""
    hoy = _crear("abierta")
    _crear("cerrada", hace=timedelta(days=1))

    r = admin_client.get("/api/ordenes/")

    assert r.status_code == HTTPStatus.OK
    assert [o["id"] for o in r.data["results"]] == [hoy.id]


def test_filtro_estado_abierta(admin_client):
    abierta = _crear("abierta")
    _crear("cerrada")
    _crear("anulada")

    r = admin_client.get("/api/ordenes/", {"estado": "abierta"})

    assert r.status_code == HTTPStatus.OK
    assert [o["id"] for o in r.data["results"]] == [abierta.id]
