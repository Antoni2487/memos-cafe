from datetime import date
from datetime import datetime
from decimal import Decimal
from http import HTTPStatus
from zoneinfo import ZoneInfo

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from memos_cafe.caja.models import Caja
from memos_cafe.caja.models import Pago
from memos_cafe.caja.tests.factories import CajaFactory
from memos_cafe.caja.tests.factories import OrdenFactory
from memos_cafe.users.tests.factories import UserFactory
from memos_cafe.utils.fechas import entre_fechas

pytestmark = pytest.mark.django_db


@pytest.fixture
def cajero_client():
    grupo, _ = Group.objects.get_or_create(name="cajero")
    usuario = UserFactory()
    usuario.groups.add(grupo)
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


class TestPagoProcesarSinMontoRecibido:
    """serializer.validated_data['monto_recibido'] tira KeyError cuando el
    campo no viene en el payload (required=False sin default). Pasa en todo
    pago que no sea efectivo, y en efectivo sin monto recibido explicito."""

    def test_pago_con_tarjeta_sin_monto_recibido_no_revienta(self, cajero_client):
        CajaFactory()
        orden = OrdenFactory(estado="abierta", total=Decimal("50.00"))

        r = cajero_client.post(
            "/api/caja/pagos/procesar/",
            {
                "orden": orden.id,
                "metodo_pago": "tarjeta",
                "monto": "50.00",
                "numero_operacion": "OP123",
            },
            format="json",
        )

        assert r.status_code == HTTPStatus.CREATED
        assert r.data["estado"] == "completado"

    def test_pago_efectivo_sin_monto_recibido_no_revienta(self, cajero_client):
        CajaFactory()
        orden = OrdenFactory(estado="abierta", total=Decimal("30.00"))

        r = cajero_client.post(
            "/api/caja/pagos/procesar/",
            {
                "orden": orden.id,
                "metodo_pago": "efectivo",
                "monto": "30.00",
            },
            format="json",
        )

        assert r.status_code == HTTPStatus.CREATED

    def test_pago_efectivo_con_monto_recibido_calcula_vuelto(self, cajero_client):
        CajaFactory()
        orden = OrdenFactory(estado="abierta", total=Decimal("30.00"))

        r = cajero_client.post(
            "/api/caja/pagos/procesar/",
            {
                "orden": orden.id,
                "metodo_pago": "efectivo",
                "monto": "30.00",
                "monto_recibido": "50.00",
            },
            format="json",
        )

        assert r.status_code == HTTPStatus.CREATED
        assert Decimal(r.data["vuelto"]) == Decimal("20.00")


class TestPagoListadoPorCaja:
    """La pantalla de Caja muestra los pagos del turno: ?caja=<id> debe
    excluir los pagos de sesiones anteriores."""

    def test_filtra_pagos_por_caja(self, cajero_client):

        caja_vieja = CajaFactory(estado=Caja.Estado.CERRADA)
        caja_actual = CajaFactory()
        for caja in (caja_vieja, caja_actual):
            Pago.objects.create(
                orden=OrdenFactory(estado="cerrada", total=Decimal("10.00")),
                caja=caja,
                metodo_pago="efectivo",
                monto=Decimal("10.00"),
                vuelto=Decimal("0"),
            )

        r = cajero_client.get("/api/caja/pagos/", {"caja": caja_actual.id})

        assert r.status_code == HTTPStatus.OK
        assert [p["caja"] for p in r.data["results"]] == [caja_actual.id]


class TestEntreFechasEquivaleADate:
    """entre_fechas() reemplaza a los lookups __date en dashboard y
    reportes: debe devolver exactamente los mismos registros, incluidos
    los bordes del dia en hora de Lima (23:30 en Lima ya es el dia
    siguiente en UTC)."""

    def test_mismos_pagos_que_el_lookup_date(self):
        lima = ZoneInfo("America/Lima")
        caja = CajaFactory()
        momentos = [
            datetime(2026, 9, 29, 23, 59, tzinfo=lima),
            datetime(2026, 9, 30, 0, 0, tzinfo=lima),
            datetime(2026, 9, 30, 23, 30, tzinfo=lima),
            datetime(2026, 10, 1, 0, 0, tzinfo=lima),
        ]
        for momento in momentos:
            pago = Pago.objects.create(
                orden=OrdenFactory(estado="cerrada", total=Decimal("10.00")),
                caja=caja,
                metodo_pago="efectivo",
                monto=Decimal("10.00"),
                vuelto=Decimal("0"),
            )
            Pago.objects.filter(pk=pago.pk).update(fecha=momento)

        dia = date(2026, 9, 30)
        con_date = set(
            Pago.objects.filter(fecha__date=dia).values_list("pk", flat=True),
        )
        con_rango = set(
            Pago.objects.filter(**entre_fechas("fecha", dia)).values_list(
                "pk",
                flat=True,
            ),
        )

        assert con_rango == con_date
        assert len(con_rango) == 2  # noqa: PLR2004
