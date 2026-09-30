from datetime import timedelta
from decimal import Decimal
from http import HTTPStatus

import pytest
from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework.test import APIClient

from memos_cafe.caja.models import Caja
from memos_cafe.caja.models import Pago
from memos_cafe.caja.tests.factories import CajaFactory
from memos_cafe.caja.tests.factories import OrdenFactory
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


def _caja_cerrada(monto_final="125.00"):
    caja = CajaFactory(estado=Caja.Estado.CERRADA, monto_final=Decimal(monto_final))
    Caja.objects.filter(pk=caja.pk).update(fecha_cierre=timezone.now())
    return caja


def _pago(caja, metodo, monto, estado=Pago.Estado.COMPLETADO):
    return Pago.objects.create(
        orden=OrdenFactory(estado="cerrada", total=Decimal(monto)),
        caja=caja,
        metodo_pago=metodo,
        monto=Decimal(monto),
        vuelto=Decimal(0),
        estado=estado,
    )


def _rango():
    hoy = timezone.localdate()
    return {"fecha_inicio": str(hoy - timedelta(days=1)), "fecha_fin": str(hoy)}


def test_cuadre_de_una_caja(admin_client):
    caja = _caja_cerrada(monto_final="125.00")
    _pago(caja, "efectivo", "10.00")
    _pago(caja, "efectivo", "5.00")
    _pago(caja, "yape", "5.00")
    _pago(caja, "yape", "100.00", estado=Pago.Estado.ANULADO)  # no suma

    r = admin_client.get("/api/reportes/caja/", {"caja_id": caja.id})

    assert r.status_code == HTTPStatus.OK
    assert r.data["total_ventas"] == Decimal("20.00")
    assert r.data["cantidad_pagos"] == 3  # noqa: PLR2004
    assert r.data["desglose_metodos"] == {
        "efectivo": Decimal("15.00"),
        "yape": Decimal("5.00"),
    }
    # 100 inicial + 20 ventas = 120 esperado; se contaron 125
    assert r.data["diferencia"] == Decimal("5.00")


def test_filtro_por_metodo_y_caja_sin_ventas(admin_client):
    con_ventas = _caja_cerrada()
    _pago(con_ventas, "efectivo", "10.00")
    _pago(con_ventas, "yape", "7.00")
    _caja_cerrada()  # sin pagos

    r = admin_client.get("/api/reportes/caja/", {**_rango(), "metodo_pago": "yape"})

    assert r.status_code == HTTPStatus.OK
    por_caja = {t["caja_id"]: t for t in r.data["turnos"]}
    assert por_caja[con_ventas.id]["total_ventas"] == Decimal("7.00")
    assert por_caja[con_ventas.id]["desglose_metodos"] == {"yape": Decimal("7.00")}
    sin_ventas = next(t for cid, t in por_caja.items() if cid != con_ventas.id)
    assert sin_ventas["total_ventas"] == 0
    assert sin_ventas["cantidad_pagos"] == 0
    assert sin_ventas["desglose_metodos"] == {}


def test_consultas_no_crecen_con_la_cantidad_de_turnos(
    admin_client,
    django_assert_max_num_queries,
):
    for _ in range(10):
        caja = _caja_cerrada()
        _pago(caja, "efectivo", "10.00")

    # Antes eran 3 consultas por turno (N+1): 10 turnos = 30+
    with django_assert_max_num_queries(10):
        r = admin_client.get("/api/reportes/caja/", _rango())

    assert r.status_code == HTTPStatus.OK
    assert len(r.data["turnos"]) == 10  # noqa: PLR2004
