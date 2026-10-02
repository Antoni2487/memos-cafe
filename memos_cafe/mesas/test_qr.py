from decimal import Decimal

import pytest
from django.contrib.auth.models import Group
from rest_framework.test import APIClient

from memos_cafe.caja.models import SolicitudCobro
from memos_cafe.caja.tests.factories import CajaFactory
from memos_cafe.caja.tests.factories import MesaFactory
from memos_cafe.mesas.ayudas_pruebas import atender_mesa_por_qr
from memos_cafe.mesas.models import Mesa
from memos_cafe.mesas.models import PedidoPorConfirmar
from memos_cafe.mesas.models import SesionMesaQR
from memos_cafe.mesas.services import SesionMesaService
from memos_cafe.ordenes.models import Orden
from memos_cafe.productos.tests.factories import ProductoFactory
from memos_cafe.realtime import notificar as notificar_mod
from memos_cafe.roles.models import PermisoRol
from memos_cafe.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def mesero():
    grupo, _ = Group.objects.get_or_create(name="mesero")
    usuario = UserFactory()
    usuario.groups.add(grupo)
    # Las acciones de mesas estan gateadas por el modulo "mesas" — ver
    # mesas/tests.py::TestMesaModuloHabilitado para el mismo patron.
    PermisoRol.objects.update_or_create(
        modulo="mesas",
        rol="mesero",
        defaults={"puede_acceder": True},
    )
    return usuario


@pytest.fixture
def mesero_client(mesero):
    client = APIClient()
    client.force_authenticate(user=mesero)
    return client


class TestSesionDeLaMesa:
    def test_sesion_activa_none_si_no_hay_ninguna(self):
        mesa = MesaFactory()
        assert SesionMesaService.sesion_activa(mesa) is None

    def test_confirmar_el_primer_pedido_abre_la_sesion_a_nombre_del_mesero(
        self,
        mesero,
    ):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)

        atender_mesa_por_qr(mesa, mesero)

        mesa.refresh_from_db()
        sesion = SesionMesaService.sesion_activa(mesa)
        assert mesa.estado == Mesa.Estado.OCUPADA
        assert sesion.mesero_id == mesero.id

    def test_liberar_mesa_cierra_la_sesion_sola(self, mesero):
        """Mesa.liberar() (llamado por Orden.cerrar()/anular()) debe
        invalidar la sesion QR sin que ordenes/services.py sepa que
        SesionMesaQR existe."""
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        atender_mesa_por_qr(mesa, mesero)
        sesion = SesionMesaService.sesion_activa(mesa)

        mesa.liberar()

        sesion.refresh_from_db()
        assert sesion.esta_activa is False
        assert SesionMesaService.sesion_activa(mesa) is None


class TestSesionMesaServiceRegistrarPedido:
    def test_mesa_sin_pedido_queda_por_confirmar(self):
        """El primer pedido siempre espera a un mesero y no crea orden."""
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        producto = ProductoFactory(precio=Decimal("10.00"))
        resultado = SesionMesaService.registrar_pedido(
            mesa,
            items=[{"producto": producto, "cantidad": 1}],
        )
        assert isinstance(resultado, PedidoPorConfirmar)
        assert not Orden.objects.filter(mesa=mesa).exists()

    def test_una_sesion_vieja_sin_pedido_no_salta_la_confirmacion(self, mesero):
        """Antes el mesero podia "abrir la mesa para QR" y el primer pedido
        iba directo a cocina. Una sesion que quedo asi no debe saltarse la
        confirmacion."""
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.OCUPADA)
        SesionMesaQR.objects.create(mesa=mesa, mesero=mesero)

        resultado = SesionMesaService.registrar_pedido(
            mesa,
            items=[{"producto": ProductoFactory(), "cantidad": 1}],
        )

        assert isinstance(resultado, PedidoPorConfirmar)
        assert not Orden.objects.filter(mesa=mesa).exists()

    def test_al_confirmar_se_crea_la_orden_en_ronda_1_a_nombre_del_mesero(
        self,
        mesero,
    ):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        producto = ProductoFactory(precio=Decimal("10.00"))

        orden = atender_mesa_por_qr(
            mesa,
            mesero,
            items=[{"producto": producto, "cantidad": 2}],
        )

        assert orden.mesa_id == mesa.id
        assert orden.usuario_id == mesero.id
        assert orden.estado == Orden.Estado.ABIERTA
        detalle = orden.detalles.get()
        assert detalle.ronda == 1
        assert detalle.cantidad == 2

    def test_lo_siguiente_va_directo_como_otra_ronda_y_avisa_a_los_meseros(
        self,
        mesero,
        monkeypatch,
        django_capture_on_commit_callbacks,
    ):
        enviados = []
        monkeypatch.setattr(
            notificar_mod,
            "_enviar",
            lambda grupos, evento: enviados.append((tuple(grupos), evento)),
        )
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        orden1 = atender_mesa_por_qr(mesa, mesero)
        producto = ProductoFactory(nombre="Latte", precio=Decimal("10.00"))

        with django_capture_on_commit_callbacks(execute=True):
            orden2 = SesionMesaService.registrar_pedido(
                mesa,
                items=[{"producto": producto, "cantidad": 3}],
            )

        assert orden1.id == orden2.id  # misma orden, no una nueva
        rondas = sorted(orden2.detalles.values_list("ronda", flat=True))
        assert rondas == [1, 2]
        aviso = next(e for g, e in enviados if e["type"] == "pedido.ronda_qr")
        assert aviso["mesa_numero"] == mesa.numero
        assert aviso["ronda"] == 2
        assert aviso["resumen"] == "3 Latte"


class TestSesionMesaServiceSolicitarCobro:
    def test_sin_orden_abierta_lanza_error(self):
        mesa = MesaFactory()
        with pytest.raises(ValueError, match="No hay una orden abierta"):
            SesionMesaService.solicitar_cobro(mesa, metodo_pago_sugerido="efectivo")

    def test_crea_la_solicitud(self, mesero):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        orden = atender_mesa_por_qr(mesa, mesero)

        solicitud = SesionMesaService.solicitar_cobro(mesa, metodo_pago_sugerido="yape")

        assert solicitud.orden_id == orden.id
        assert solicitud.metodo_pago_sugerido == "yape"
        assert solicitud.esta_pendiente is True
        assert SolicitudCobro.objects.filter(orden=orden).count() == 1


class TestYaNoSeAbreLaMesaParaQR:
    def test_los_endpoints_viejos_no_existen(self, mesero_client):
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)

        abrir = mesero_client.post(f"/api/mesas/{mesa.id}/abrir-qr/")
        cerrar = mesero_client.post(f"/api/mesas/{mesa.id}/cerrar-qr/")

        assert abrir.status_code == 404
        assert cerrar.status_code == 404
        mesa.refresh_from_db()
        assert mesa.estado == Mesa.Estado.LIBRE


class TestMesaQREndpointsPublicos:
    """Sin autenticacion — es exactamente lo que un cliente final ve desde
    su celular tras escanear el QR."""

    def test_estado_sin_sesion(self):
        mesa = MesaFactory()
        client = APIClient()
        r = client.get(f"/api/mesas/qr/{mesa.codigo_qr}/")
        assert r.status_code == 200
        assert r.data["sesion_activa"] is False
        assert r.data["orden"] is None

    def test_estado_con_la_mesa_atendida(self, mesero):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        orden = atender_mesa_por_qr(mesa, mesero)
        client = APIClient()
        r = client.get(f"/api/mesas/qr/{mesa.codigo_qr}/")
        assert r.status_code == 200
        assert r.data["sesion_activa"] is True
        assert r.data["orden"]["id"] == orden.id

    def test_pedido_sin_sesion_activa_queda_por_confirmar(self):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        producto = ProductoFactory(precio=Decimal("10.00"))
        client = APIClient()
        r = client.post(
            f"/api/mesas/qr/{mesa.codigo_qr}/pedido/",
            {"items": [{"producto": producto.id, "cantidad": 1}]},
            format="json",
        )
        assert r.status_code == 202
        assert r.data["estado"] == "por_confirmar"

    def test_pedido_completo_end_to_end(self, mesero):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        producto = ProductoFactory(precio=Decimal("12.50"))
        client = APIClient()

        # primer pedido: espera al mesero
        r1 = client.post(
            f"/api/mesas/qr/{mesa.codigo_qr}/pedido/",
            {"items": [{"producto": producto.id, "cantidad": 2}]},
            format="json",
        )
        assert r1.status_code == 202
        orden = SesionMesaService.confirmar_pedido(
            PedidoPorConfirmar.objects.get(pk=r1.data["pedido_por_confirmar"]["id"]),
            mesero=mesero,
        )
        orden_id = orden.id

        # segunda ronda
        r2 = client.post(
            f"/api/mesas/qr/{mesa.codigo_qr}/pedido/",
            {"items": [{"producto": producto.id, "cantidad": 1}]},
            format="json",
        )
        assert r2.status_code == 201
        assert r2.data["id"] == orden_id
        assert len(r2.data["detalles"]) == 2

        # el estado ahora refleja el pedido completo
        r_estado = client.get(f"/api/mesas/qr/{mesa.codigo_qr}/")
        assert r_estado.data["orden"]["id"] == orden_id
        assert len(r_estado.data["orden"]["detalles"]) == 2

        # solicitar cobro
        r_cobro = client.post(
            f"/api/mesas/qr/{mesa.codigo_qr}/solicitar-cobro/",
            {"metodo_pago_sugerido": "efectivo"},
            format="json",
        )
        assert r_cobro.status_code == 201
        assert SolicitudCobro.objects.filter(orden_id=orden_id).exists()

    def test_solicitar_cobro_sin_orden_rechaza(self):
        mesa = MesaFactory()
        client = APIClient()
        r = client.post(
            f"/api/mesas/qr/{mesa.codigo_qr}/solicitar-cobro/",
            {"metodo_pago_sugerido": "efectivo"},
            format="json",
        )
        assert r.status_code == 400

    def test_mesa_inactiva_da_404(self):
        mesa = MesaFactory(activo=False)
        client = APIClient()
        r = client.get(f"/api/mesas/qr/{mesa.codigo_qr}/")
        assert r.status_code == 404
