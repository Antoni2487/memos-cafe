"""Primer pedido por QR de una mesa libre: espera a que un mesero confirme
que hay gente sentada. Despues, las rondas van directo a Cocina."""

from datetime import timedelta
from decimal import Decimal
from http import HTTPStatus

import pytest
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from memos_cafe.caja.tests.factories import CajaFactory
from memos_cafe.caja.tests.factories import MesaFactory
from memos_cafe.mesas.models import Mesa
from memos_cafe.mesas.models import PedidoPorConfirmar
from memos_cafe.mesas.services import SesionMesaService
from memos_cafe.ordenes.models import Comanda
from memos_cafe.ordenes.models import Orden
from memos_cafe.ordenes.services import OrdenService
from memos_cafe.productos.tests.factories import ProductoFactory
from memos_cafe.realtime import notificar as notificar_mod
from memos_cafe.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _base():
    cache.clear()  # limites de uso de los endpoints publicos
    CajaFactory()


@pytest.fixture
def mesa():
    return MesaFactory(estado=Mesa.Estado.LIBRE)


@pytest.fixture
def producto():
    return ProductoFactory(nombre="Capuchino", precio=Decimal("9.50"))


def _usuario(rol):
    usuario = UserFactory()
    usuario.groups.add(Group.objects.get_or_create(name=rol)[0])
    return usuario


def _cliente(usuario=None):
    client = APIClient()
    if usuario:
        client.force_authenticate(user=usuario)
    return client


def _pedir(mesa, producto, cantidad=1, nota=""):
    return _cliente().post(
        f"/api/mesas/qr/{mesa.codigo_qr}/pedido/",
        {"items": [{"producto": producto.id, "cantidad": cantidad, "nota": nota}]},
        format="json",
    )


class TestPrimerPedido:
    def test_queda_por_confirmar_sin_crear_orden(self, mesa, producto):
        r = _pedir(mesa, producto, cantidad=2)

        assert r.status_code == HTTPStatus.ACCEPTED
        pedido = r.data["pedido_por_confirmar"]
        assert pedido["estado"] == "pendiente"
        assert pedido["total"] == "19.00"
        assert not Orden.objects.filter(mesa=mesa).exists()
        mesa.refresh_from_db()
        assert mesa.estado == Mesa.Estado.LIBRE

    def test_avisa_a_los_meseros(
        self,
        mesa,
        producto,
        monkeypatch,
        django_capture_on_commit_callbacks,
    ):
        enviados = []
        monkeypatch.setattr(
            notificar_mod,
            "_enviar",
            lambda grupos, evento: enviados.append((grupos, evento)),
        )
        with django_capture_on_commit_callbacks(execute=True):
            _pedir(mesa, producto)

        ((grupos, evento),) = enviados
        assert grupos == ["meseros"]
        assert evento["type"] == "pedido.por_confirmar"
        assert evento["mesa_numero"] == mesa.numero

    def test_otro_celular_de_la_mesa_se_suma_al_mismo_pedido(self, mesa, producto):
        _pedir(mesa, producto, cantidad=1)
        otro = ProductoFactory(precio=Decimal("12.00"))
        _pedir(mesa, otro, cantidad=2)

        pedido = PedidoPorConfirmar.objects.get(mesa=mesa)
        assert pedido.estado == PedidoPorConfirmar.Estado.PENDIENTE
        assert [i["cantidad"] for i in pedido.items] == [1, 2]

    def test_el_cliente_ve_su_pedido_esperando(self, mesa, producto):
        _pedir(mesa, producto)

        r = _cliente().get(f"/api/mesas/qr/{mesa.codigo_qr}/")

        assert r.data["sesion_activa"] is False
        assert r.data["orden"] is None
        assert r.data["pedido_por_confirmar"]["estado"] == "pendiente"


class TestConfirmacion:
    def test_confirmar_crea_la_orden_a_nombre_del_mesero(self, mesa, producto):
        _pedir(mesa, producto, cantidad=2, nota="sin azucar")
        pedido = PedidoPorConfirmar.objects.get(mesa=mesa)
        mesero = _usuario("mesero")

        orden = SesionMesaService.confirmar_pedido(pedido, mesero=mesero)

        assert orden.usuario == mesero
        comanda = orden.comandas.get()
        assert comanda.origen == Comanda.Origen.QR
        detalle = comanda.detalles.get()
        assert (detalle.cantidad, detalle.nota) == (2, "sin azucar")
        mesa.refresh_from_db()
        assert mesa.estado == Mesa.Estado.OCUPADA
        assert SesionMesaService.sesion_activa(mesa) is not None
        pedido.refresh_from_db()
        assert pedido.estado == PedidoPorConfirmar.Estado.CONFIRMADO
        assert pedido.orden == orden
        assert pedido.resuelto_por == mesero

    def test_despues_de_confirmar_las_rondas_van_directo(self, mesa, producto):
        _pedir(mesa, producto)
        SesionMesaService.confirmar_pedido(
            PedidoPorConfirmar.objects.get(mesa=mesa),
            mesero=_usuario("mesero"),
        )

        r = _pedir(mesa, producto, cantidad=3)

        assert r.status_code == HTTPStatus.CREATED
        orden = Orden.objects.get(mesa=mesa, estado=Orden.Estado.ABIERTA)
        assert list(orden.comandas.values_list("numero", flat=True)) == [1, 2]
        assert PedidoPorConfirmar.objects.filter(mesa=mesa).count() == 1

    def test_si_el_mesero_ya_abrio_la_mesa_a_mano_el_qr_suma_rondas(
        self,
        mesa,
        producto,
    ):
        OrdenService.crear_orden(
            usuario=_usuario("mesero"),
            tipo_orden="mesa",
            mesa=mesa,
            detalles=[{"producto": producto, "cantidad": 1}],
        )

        r = _pedir(mesa, producto)

        assert r.status_code == HTTPStatus.CREATED
        assert not PedidoPorConfirmar.objects.filter(mesa=mesa).exists()

    def test_no_se_puede_confirmar_dos_veces(self, mesa, producto):
        _pedir(mesa, producto)
        pedido = PedidoPorConfirmar.objects.get(mesa=mesa)
        SesionMesaService.confirmar_pedido(pedido, mesero=_usuario("mesero"))

        with pytest.raises(ValueError, match="ya fue confirmado"):
            SesionMesaService.confirmar_pedido(pedido, mesero=_usuario("mesero"))

    def test_producto_agotado_mientras_esperaba(self, mesa, producto):
        _pedir(mesa, producto)
        producto.disponible = False
        producto.save()
        pedido = PedidoPorConfirmar.objects.get(mesa=mesa)

        with pytest.raises(ValueError, match="ya no esta disponible"):
            SesionMesaService.confirmar_pedido(pedido, mesero=_usuario("mesero"))
        pedido.refresh_from_db()
        assert pedido.estado == PedidoPorConfirmar.Estado.PENDIENTE


class TestRechazoYExpiracion:
    def test_rechazar_no_crea_nada_y_el_cliente_se_entera(self, mesa, producto):
        _pedir(mesa, producto)
        pedido = PedidoPorConfirmar.objects.get(mesa=mesa)

        SesionMesaService.rechazar_pedido(pedido, mesero=_usuario("mesero"))

        assert not Orden.objects.filter(mesa=mesa).exists()
        mesa.refresh_from_db()
        assert mesa.estado == Mesa.Estado.LIBRE
        r = _cliente().get(f"/api/mesas/qr/{mesa.codigo_qr}/")
        assert r.data["pedido_por_confirmar"]["estado"] == "rechazado"

    def test_un_pedido_sin_respuesta_expira(self, mesa, producto):
        _pedir(mesa, producto)
        viejo = timezone.now() - timedelta(
            minutes=SesionMesaService.MINUTOS_EXPIRA_POR_CONFIRMAR + 1,
        )
        PedidoPorConfirmar.objects.filter(mesa=mesa).update(actualizado_en=viejo)

        assert not SesionMesaService.pendientes().exists()
        assert (
            PedidoPorConfirmar.objects.get(mesa=mesa).estado
            == PedidoPorConfirmar.Estado.EXPIRADO
        )

    def test_tras_expirar_un_pedido_nuevo_vuelve_a_esperar(self, mesa, producto):
        _pedir(mesa, producto)
        viejo = timezone.now() - timedelta(minutes=60)
        PedidoPorConfirmar.objects.filter(mesa=mesa).update(actualizado_en=viejo)

        r = _pedir(mesa, producto)

        assert r.status_code == HTTPStatus.ACCEPTED
        assert PedidoPorConfirmar.objects.filter(mesa=mesa).count() == 2


class TestApiDelPersonal:
    def test_mesero_lista_y_confirma(self, mesa, producto):
        _pedir(mesa, producto)
        mesero = _cliente(_usuario("mesero"))

        r = mesero.get("/api/mesas/pedidos-por-confirmar/")
        assert r.status_code == HTTPStatus.OK
        (pedido,) = r.data
        assert pedido["mesa_numero"] == mesa.numero

        r = mesero.post(f"/api/mesas/pedidos-por-confirmar/{pedido['id']}/confirmar/")
        assert r.status_code == HTTPStatus.OK
        assert Orden.objects.filter(pk=r.data["orden_id"], mesa=mesa).exists()

    def test_cajero_puede_rechazar(self, mesa, producto):
        _pedir(mesa, producto)
        pedido = PedidoPorConfirmar.objects.get(mesa=mesa)

        r = _cliente(_usuario("cajero")).post(
            f"/api/mesas/pedidos-por-confirmar/{pedido.id}/rechazar/",
        )

        assert r.status_code == HTTPStatus.NO_CONTENT

    def test_cocina_y_anonimos_no(self, mesa, producto):
        _pedir(mesa, producto)
        url = "/api/mesas/pedidos-por-confirmar/"

        assert _cliente(_usuario("cocina")).get(url).status_code == HTTPStatus.FORBIDDEN
        assert _cliente().get(url).status_code in (
            HTTPStatus.UNAUTHORIZED,
            HTTPStatus.FORBIDDEN,
        )

    def test_el_listado_de_mesas_sigue_funcionando(self, mesa):
        """Las rutas de pedidos por confirmar van antes que las de mesas."""
        admin = _cliente(_usuario("admin"))
        assert admin.get("/api/mesas/").status_code == HTTPStatus.OK
        assert admin.get(f"/api/mesas/{mesa.id}/").status_code == HTTPStatus.OK

    def test_sin_respuesta_en_minutos_le_llega_al_admin(self, mesa, producto):
        _pedir(mesa, producto)
        hace = timezone.now() - timedelta(
            minutes=SesionMesaService.MINUTOS_ESCALA_POR_CONFIRMAR + 1,
        )
        PedidoPorConfirmar.objects.filter(mesa=mesa).update(creado_en=hace)

        r = _cliente(_usuario("admin")).get("/api/alertas/")

        assert any(a["tipo"] == "pedido_por_confirmar" for a in r.data)


class TestLoQueVeElCliente:
    def _mesa_con_orden(self, mesa, producto):
        _pedir(mesa, producto)
        SesionMesaService.confirmar_pedido(
            PedidoPorConfirmar.objects.get(mesa=mesa),
            mesero=_usuario("mesero"),
        )

    def test_ve_sus_rondas_con_su_estado(self, mesa, producto):
        self._mesa_con_orden(mesa, producto)
        _pedir(mesa, producto, cantidad=2)

        orden = _cliente().get(f"/api/mesas/qr/{mesa.codigo_qr}/").data["orden"]

        assert [(c["numero"], c["origen"], c["estado"]) for c in orden["comandas"]] == [
            (1, "qr", "pendiente"),
            (2, "qr", "pendiente"),
        ]
        assert [d["ronda"] for d in orden["detalles"]] == [1, 2]

    def test_pedir_la_cuenta_queda_guardado(self, mesa, producto):
        self._mesa_con_orden(mesa, producto)
        url = f"/api/mesas/qr/{mesa.codigo_qr}/"
        assert _cliente().get(url).data["orden"]["cuenta_solicitada"] is False

        _cliente().post(
            f"{url}solicitar-cobro/",
            {"metodo_pago_sugerido": "yape"},
            format="json",
        )

        # Otro celular (o el mismo tras recargar) lo sigue viendo
        assert _cliente().get(url).data["orden"]["cuenta_solicitada"] is True

    def test_consultas_constantes(self, mesa, producto, django_assert_max_num_queries):
        self._mesa_con_orden(mesa, producto)
        for _ in range(4):
            _pedir(mesa, ProductoFactory(), cantidad=1)

        with django_assert_max_num_queries(10):
            r = _cliente().get(f"/api/mesas/qr/{mesa.codigo_qr}/")
        assert len(r.data["orden"]["detalles"]) == 5
