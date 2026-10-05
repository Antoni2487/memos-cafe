"""Ningún campo acepta valores absurdos: el servidor responde 400 con un
mensaje en español, nunca un error 500 ni guarda basura (reporte: se podía
escribir "8888888888…" como número de mesa)."""

from decimal import Decimal
from http import HTTPStatus

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from memos_cafe.caja.tests.factories import CajaFactory
from memos_cafe.mesas.models import Mesa
from memos_cafe.ordenes.models import Orden
from memos_cafe.productos.tests.factories import ProductoFactory
from memos_cafe.users.tests.factories import UserFactory
from memos_cafe.utils.limites import LINEAS_POR_PEDIDO_MAX

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin():
    usuario = UserFactory()
    usuario.groups.add(Group.objects.get_or_create(name="admin")[0])
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


class TestMesas:
    def test_numero_gigante_se_rechaza_en_espanol(self, admin):
        r = admin.post(
            "/api/mesas/",
            {"numero": 8888888888864444, "capacidad": 4},
            format="json",
        )

        assert r.status_code == HTTPStatus.BAD_REQUEST
        assert "menor o igual a 999" in str(r.data["numero"][0])
        assert not Mesa.objects.exists()

    def test_capacidad_gigante_se_rechaza(self, admin):
        r = admin.post(
            "/api/mesas/",
            {"numero": 7, "capacidad": 5555555555555},
            format="json",
        )

        assert r.status_code == HTTPStatus.BAD_REQUEST
        assert "capacidad" in r.data


class TestPedidos:
    def _pedir(self, admin, detalles):
        CajaFactory()
        return admin.post(
            "/api/ordenes/crear/",
            {"tipo_orden": "llevar", "detalles": detalles},
            format="json",
        )

    def test_cantidad_gigante_no_rompe_el_servidor(self, admin):
        """Antes: 500 (smallint out of range)."""
        producto = ProductoFactory()

        r = self._pedir(admin, [{"producto": producto.id, "cantidad": 99999}])

        assert r.status_code == HTTPStatus.BAD_REQUEST
        assert not Orden.objects.exists()

    def test_hasta_99_unidades_si(self, admin):
        producto = ProductoFactory(precio=Decimal("1.00"))

        r = self._pedir(admin, [{"producto": producto.id, "cantidad": 99}])

        assert r.status_code == HTTPStatus.CREATED

    def test_no_se_mandan_miles_de_lineas_de_golpe(self, admin):
        producto = ProductoFactory()
        lineas = [{"producto": producto.id, "cantidad": 1}] * (
            LINEAS_POR_PEDIDO_MAX + 1
        )

        r = self._pedir(admin, lineas)

        assert r.status_code == HTTPStatus.BAD_REQUEST


class TestDinero:
    def test_precio_negativo_o_gigante(self, admin):
        producto = ProductoFactory()
        for precio in ("-5", "0", "99999.99"):
            r = admin.patch(
                f"/api/productos/{producto.id}/editar/",
                {"precio": precio},
                format="json",
            )
            assert r.status_code == HTTPStatus.BAD_REQUEST, precio

        valido = admin.patch(
            f"/api/productos/{producto.id}/editar/",
            {"precio": "12.50"},
            format="json",
        )
        assert valido.status_code == HTTPStatus.OK

    def test_pago_gigante(self, admin):
        CajaFactory()
        producto = ProductoFactory()
        orden = admin.post(
            "/api/ordenes/crear/",
            {
                "tipo_orden": "llevar",
                "detalles": [{"producto": producto.id, "cantidad": 1}],
            },
            format="json",
        ).data

        r = admin.post(
            "/api/caja/pagos/procesar/",
            {"orden": orden["id"], "metodo_pago": "efectivo", "monto": "999999"},
            format="json",
        )

        assert r.status_code == HTTPStatus.BAD_REQUEST
        assert "monto" in r.data
