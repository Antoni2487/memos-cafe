"""Seguridad y resiliencia del pedido por QR: codigo secreto por mesa,
limites de uso por celular y avisos en tiempo real que no rompen ordenes."""

import logging
import uuid
from decimal import Decimal
from http import HTTPStatus

import pytest
from channels.layers import channel_layers
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient

from memos_cafe.caja.tests.factories import CajaFactory
from memos_cafe.caja.tests.factories import MesaFactory
from memos_cafe.mesas.api import throttles
from memos_cafe.mesas.models import Mesa
from memos_cafe.mesas.services import SesionMesaService
from memos_cafe.ordenes.models import Orden
from memos_cafe.ordenes.services import OrdenService
from memos_cafe.productos.tests.factories import ProductoFactory
from memos_cafe.realtime import notificar as notificar_mod
from memos_cafe.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _limpiar_throttles():
    cache.clear()


@pytest.fixture
def mesa_abierta():
    CajaFactory()
    mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
    SesionMesaService.abrir_sesion(mesa, mesero=UserFactory())
    return mesa


def _cliente(dispositivo=None):
    client = APIClient()
    if dispositivo:
        client.credentials(HTTP_X_DISPOSITIVO_QR=dispositivo)
    return client


def _pedido(producto):
    return {"items": [{"producto": producto.id, "cantidad": 1}]}


class TestCodigoSecreto:
    def test_cada_mesa_tiene_un_codigo_distinto_e_impredecible(self):
        codigos = {MesaFactory().codigo_qr for _ in range(20)}
        assert len(codigos) == 20  # noqa: PLR2004
        assert all(len(c) == 12 for c in codigos)  # noqa: PLR2004

    def test_la_url_con_el_id_de_la_mesa_ya_no_sirve(self, mesa_abierta):
        prod = ProductoFactory(precio=Decimal("15.00"))

        r_get = _cliente().get(f"/api/mesas/qr/{mesa_abierta.id}/")
        r_post = _cliente().post(
            f"/api/mesas/qr/{mesa_abierta.id}/pedido/",
            _pedido(prod),
            format="json",
        )

        assert r_get.status_code == HTTPStatus.NOT_FOUND
        assert r_post.status_code == HTTPStatus.NOT_FOUND
        assert not Orden.objects.filter(mesa=mesa_abierta).exists()

    def test_codigo_inventado_da_404(self, mesa_abierta):
        r = _cliente().get("/api/mesas/qr/codigoInventado/")
        assert r.status_code == HTTPStatus.NOT_FOUND

    def test_el_endpoint_publico_no_revela_el_codigo_ni_el_id(self, mesa_abierta):
        r = _cliente().get(f"/api/mesas/qr/{mesa_abierta.codigo_qr}/")
        assert r.status_code == HTTPStatus.OK
        assert "codigo_qr" not in r.data
        assert "id" not in r.data

    def test_admin_regenera_el_codigo_y_el_qr_viejo_deja_de_funcionar(
        self,
        mesa_abierta,
    ):
        admin = UserFactory()
        admin.groups.add(Group.objects.get_or_create(name="admin")[0])
        staff = APIClient()
        staff.force_authenticate(user=admin)
        viejo = mesa_abierta.codigo_qr

        r = staff.post(f"/api/mesas/{mesa_abierta.id}/regenerar-qr/")

        assert r.status_code == HTTPStatus.OK
        nuevo = r.data["codigo_qr"]
        assert nuevo != viejo
        assert _cliente().get(f"/api/mesas/qr/{viejo}/").status_code == 404  # noqa: PLR2004
        assert _cliente().get(f"/api/mesas/qr/{nuevo}/").status_code == 200  # noqa: PLR2004

    def test_un_mesero_no_puede_regenerar_el_codigo(self, mesa_abierta):
        mesero = UserFactory()
        mesero.groups.add(Group.objects.get_or_create(name="mesero")[0])
        staff = APIClient()
        staff.force_authenticate(user=mesero)

        r = staff.post(f"/api/mesas/{mesa_abierta.id}/regenerar-qr/")

        assert r.status_code == HTTPStatus.FORBIDDEN


class TestLimitesDeUso:
    def test_una_mesa_de_cuatro_no_se_bloquea_sola(self, mesa_abierta):
        """Un minuto de polling (cada 10 s) de 4 celulares, detras de la
        misma IP del wifi, mas el envio del pedido: nadie recibe 429."""
        prod = ProductoFactory(precio=Decimal("10.00"))
        url = f"/api/mesas/qr/{mesa_abierta.codigo_qr}/"
        celulares = [_cliente(str(uuid.uuid4())) for _ in range(4)]

        respuestas = [c.get(url).status_code for _ in range(6) for c in celulares]
        pedido = celulares[0].post(f"{url}pedido/", _pedido(prod), format="json")

        assert HTTPStatus.TOO_MANY_REQUESTS not in respuestas
        assert pedido.status_code == HTTPStatus.CREATED

    def test_un_celular_abusivo_no_bloquea_al_resto_de_la_mesa(self, mesa_abierta):
        url = f"/api/mesas/qr/{mesa_abierta.codigo_qr}/"
        abusivo = _cliente(str(uuid.uuid4()))
        for _ in range(30):
            abusivo.get(url)

        assert abusivo.get(url).status_code == HTTPStatus.TOO_MANY_REQUESTS
        assert _cliente(str(uuid.uuid4())).get(url).status_code == HTTPStatus.OK

    def test_hay_un_tope_por_mesa_aunque_se_cambie_el_id_de_dispositivo(
        self,
        mesa_abierta,
        monkeypatch,
    ):
        monkeypatch.setattr(
            throttles.QRLecturaMesaThrottle,
            "rate",
            "5/minute",
            raising=False,
        )
        url = f"/api/mesas/qr/{mesa_abierta.codigo_qr}/"

        codigos = [_cliente(str(uuid.uuid4())).get(url).status_code for _ in range(6)]

        assert codigos[:5] == [HTTPStatus.OK] * 5
        assert codigos[5] == HTTPStatus.TOO_MANY_REQUESTS

    def test_la_carta_publica_aguanta_a_muchos_clientes_con_la_misma_ip(self):
        """Antes usaba el limite anonimo general: 20/min por IP."""
        client = APIClient()
        codigos = {client.get("/api/productos/publico/").status_code for _ in range(40)}
        assert codigos == {HTTPStatus.OK}


REDIS_CAIDO = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": ["redis://127.0.0.1:1/0"]},
    },
}


class TestAvisosEnTiempoReal:
    def _crear_orden(self):
        CajaFactory()
        return OrdenService.crear_orden(
            usuario=UserFactory(),
            tipo_orden="mesa",
            mesa=MesaFactory(estado=Mesa.Estado.LIBRE),
            detalles=[{"producto": ProductoFactory(), "cantidad": 1}],
        )

    def test_el_aviso_a_cocina_sale_recien_al_confirmar_la_orden(
        self,
        monkeypatch,
        django_capture_on_commit_callbacks,
    ):
        enviados = []
        monkeypatch.setattr(
            notificar_mod,
            "_enviar",
            lambda grupos, evento: enviados.append((grupos, evento["type"])),
        )

        with django_capture_on_commit_callbacks() as callbacks:
            self._crear_orden()
            assert enviados == []  # nada antes del commit

        for callback in callbacks:
            callback()
        assert enviados == [(["cocina"], "pedido.nuevo")]

    @override_settings(CHANNEL_LAYERS=REDIS_CAIDO)
    def test_con_redis_caido_la_orden_se_crea_igual(
        self,
        caplog,
        django_capture_on_commit_callbacks,
    ):
        channel_layers.backends.clear()
        try:
            with (
                caplog.at_level(logging.ERROR, logger="memos_cafe.realtime"),
                django_capture_on_commit_callbacks(execute=True),
            ):
                orden = self._crear_orden()
        finally:
            channel_layers.backends.clear()

        assert Orden.objects.filter(pk=orden.pk).exists()
        assert "No se pudo notificar pedido.nuevo" in caplog.text
