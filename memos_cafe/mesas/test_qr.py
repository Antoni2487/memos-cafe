from decimal import Decimal

import pytest
from django.contrib.auth.models import Group
from django.core.cache import cache
from rest_framework.test import APIClient

from memos_cafe.caja.models import SolicitudCobro
from memos_cafe.caja.tests.factories import CajaFactory, MesaFactory
from memos_cafe.mesas.models import Mesa, SesionMesaQR
from memos_cafe.mesas.services import SesionMesaService
from memos_cafe.ordenes.models import Orden
from memos_cafe.productos.tests.factories import ProductoFactory
from memos_cafe.roles.models import PermisoRol
from memos_cafe.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def mesero():
    grupo, _ = Group.objects.get_or_create(name="mesero")
    usuario = UserFactory()
    usuario.groups.add(grupo)
    # abrir-qr esta gateado por el modulo "mesas", igual que "estado" —
    # ver mesas/tests.py::TestMesaModuloHabilitado para el mismo patron.
    PermisoRol.objects.update_or_create(
        modulo="mesas", rol="mesero", defaults={"puede_acceder": True}
    )
    return usuario


@pytest.fixture
def mesero_client(mesero):
    client = APIClient()
    client.force_authenticate(user=mesero)
    return client


class TestSesionMesaServiceAbrirSesion:
    def test_abre_sesion_y_ocupa_la_mesa(self, mesero):
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        sesion = SesionMesaService.abrir_sesion(mesa, mesero=mesero)

        mesa.refresh_from_db()
        assert mesa.estado == Mesa.Estado.OCUPADA
        assert sesion.mesa_id == mesa.id
        assert sesion.mesero_id == mesero.id
        assert sesion.esta_activa is True

    def test_no_se_puede_abrir_si_la_mesa_no_esta_libre(self, mesero):
        mesa = MesaFactory(estado=Mesa.Estado.OCUPADA)
        with pytest.raises(ValueError, match="no está libre"):
            SesionMesaService.abrir_sesion(mesa, mesero=mesero)

    def test_sesion_activa_none_si_no_hay_ninguna(self):
        mesa = MesaFactory()
        assert SesionMesaService.sesion_activa(mesa) is None

    def test_liberar_mesa_cierra_la_sesion_sola(self, mesero):
        """Mesa.liberar() (llamado por Orden.cerrar()/anular()) debe
        invalidar la sesion QR sin que ordenes/services.py sepa que
        SesionMesaQR existe."""
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        sesion = SesionMesaService.abrir_sesion(mesa, mesero=mesero)

        mesa.liberar()

        sesion.refresh_from_db()
        assert sesion.esta_activa is False
        assert SesionMesaService.sesion_activa(mesa) is None


class TestSesionMesaServiceRegistrarPedido:
    def test_sin_sesion_activa_lanza_error(self):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        producto = ProductoFactory(precio=Decimal("10.00"))
        with pytest.raises(ValueError, match="Pedile a tu mesero"):
            SesionMesaService.registrar_pedido(
                mesa, items=[{"producto": producto, "cantidad": 1}]
            )

    def test_primer_pedido_crea_la_orden_en_ronda_1(self, mesero):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        SesionMesaService.abrir_sesion(mesa, mesero=mesero)
        producto = ProductoFactory(precio=Decimal("10.00"))

        orden = SesionMesaService.registrar_pedido(
            mesa, items=[{"producto": producto, "cantidad": 2}]
        )

        assert orden.mesa_id == mesa.id
        assert orden.usuario_id == mesero.id  # atribuido a quien abrio la sesion
        assert orden.estado == Orden.Estado.ABIERTA
        detalle = orden.detalles.get()
        assert detalle.ronda == 1
        assert detalle.cantidad == 2

    def test_segundo_pedido_agrega_una_ronda_nueva_a_la_misma_orden(self, mesero):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        SesionMesaService.abrir_sesion(mesa, mesero=mesero)
        producto = ProductoFactory(precio=Decimal("10.00"))

        orden1 = SesionMesaService.registrar_pedido(
            mesa, items=[{"producto": producto, "cantidad": 1}]
        )
        orden2 = SesionMesaService.registrar_pedido(
            mesa, items=[{"producto": producto, "cantidad": 3}]
        )

        assert orden1.id == orden2.id  # misma orden, no una nueva
        rondas = sorted(orden2.detalles.values_list("ronda", flat=True))
        assert rondas == [1, 2]


class TestSesionMesaServiceSolicitarCobro:
    def test_sin_orden_abierta_lanza_error(self):
        mesa = MesaFactory()
        with pytest.raises(ValueError, match="No hay una orden abierta"):
            SesionMesaService.solicitar_cobro(mesa, metodo_pago_sugerido="efectivo")

    def test_crea_la_solicitud(self, mesero):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        SesionMesaService.abrir_sesion(mesa, mesero=mesero)
        producto = ProductoFactory(precio=Decimal("10.00"))
        orden = SesionMesaService.registrar_pedido(
            mesa, items=[{"producto": producto, "cantidad": 1}]
        )

        solicitud = SesionMesaService.solicitar_cobro(mesa, metodo_pago_sugerido="yape")

        assert solicitud.orden_id == orden.id
        assert solicitud.metodo_pago_sugerido == "yape"
        assert solicitud.esta_pendiente is True
        assert SolicitudCobro.objects.filter(orden=orden).count() == 1


class TestMesaAbrirSesionQREndpoint:
    def test_requiere_autenticacion(self):
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        client = APIClient()
        r = client.post(f"/api/mesas/{mesa.id}/abrir-qr/")
        assert r.status_code == 401

    def test_mesero_abre_sesion_ok(self, mesero_client):
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        r = mesero_client.post(f"/api/mesas/{mesa.id}/abrir-qr/")
        assert r.status_code == 201
        assert "token" in r.data
        # el body de la respuesta debe reflejar el estado real, no una
        # copia en memoria desactualizada de antes de abrir_sesion().
        assert r.data["mesa"]["estado"] == "ocupada"
        mesa.refresh_from_db()
        assert mesa.estado == Mesa.Estado.OCUPADA

    def test_no_se_puede_abrir_mesa_ya_ocupada(self, mesero_client):
        mesa = MesaFactory(estado=Mesa.Estado.OCUPADA)
        r = mesero_client.post(f"/api/mesas/{mesa.id}/abrir-qr/")
        assert r.status_code == 400


class TestCancelarSesionQR:
    """Tapa el hueco de la mesa que queda 'ocupada' sin salida si se abre
    una sesion QR por error y nunca se genera ningun pedido."""

    def test_cancela_sesion_sin_pedidos_y_libera_la_mesa(self, mesero):
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        SesionMesaService.abrir_sesion(mesa, mesero=mesero)

        SesionMesaService.cancelar_sesion(mesa)

        mesa.refresh_from_db()
        assert mesa.estado == Mesa.Estado.LIBRE
        assert SesionMesaService.sesion_activa(mesa) is None

    def test_rechaza_si_no_hay_sesion_activa(self):
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        with pytest.raises(ValueError, match="no tiene una sesión"):
            SesionMesaService.cancelar_sesion(mesa)

    def test_rechaza_si_ya_hay_un_pedido_en_curso(self, mesero):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        SesionMesaService.abrir_sesion(mesa, mesero=mesero)
        producto = ProductoFactory(precio=Decimal("10.00"))
        SesionMesaService.registrar_pedido(mesa, items=[{"producto": producto, "cantidad": 1}])

        with pytest.raises(ValueError, match="ya tiene un pedido en curso"):
            SesionMesaService.cancelar_sesion(mesa)

        mesa.refresh_from_db()
        assert mesa.estado == Mesa.Estado.OCUPADA

    def test_endpoint_mesero_cancela_ok(self, mesero_client, mesero):
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        SesionMesaService.abrir_sesion(mesa, mesero=mesero)

        r = mesero_client.post(f"/api/mesas/{mesa.id}/cerrar-qr/")

        assert r.status_code == 200
        assert r.data["estado"] == "libre"

    def test_endpoint_rechaza_con_pedido_en_curso(self, mesero_client, mesero):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        SesionMesaService.abrir_sesion(mesa, mesero=mesero)
        producto = ProductoFactory(precio=Decimal("10.00"))
        SesionMesaService.registrar_pedido(mesa, items=[{"producto": producto, "cantidad": 1}])

        r = mesero_client.post(f"/api/mesas/{mesa.id}/cerrar-qr/")

        assert r.status_code == 400


class TestMesaQREndpointsPublicos:
    """Sin autenticacion — es exactamente lo que un cliente final ve desde
    su celular tras escanear el QR."""

    def test_estado_sin_sesion(self):
        mesa = MesaFactory()
        client = APIClient()
        r = client.get(f"/api/mesas/qr/{mesa.id}/")
        assert r.status_code == 200
        assert r.data["sesion_activa"] is False
        assert r.data["orden"] is None

    def test_estado_con_sesion_activa_sin_pedido_aun(self, mesero):
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        SesionMesaService.abrir_sesion(mesa, mesero=mesero)
        client = APIClient()
        r = client.get(f"/api/mesas/qr/{mesa.id}/")
        assert r.status_code == 200
        assert r.data["sesion_activa"] is True
        assert r.data["orden"] is None

    def test_pedido_sin_sesion_activa_rechaza(self):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        producto = ProductoFactory(precio=Decimal("10.00"))
        client = APIClient()
        r = client.post(
            f"/api/mesas/qr/{mesa.id}/pedido/",
            {"items": [{"producto": producto.id, "cantidad": 1}]},
            format="json",
        )
        assert r.status_code == 400

    def test_pedido_completo_end_to_end(self, mesero):
        CajaFactory()
        mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
        SesionMesaService.abrir_sesion(mesa, mesero=mesero)
        producto = ProductoFactory(precio=Decimal("12.50"))
        client = APIClient()

        r1 = client.post(
            f"/api/mesas/qr/{mesa.id}/pedido/",
            {"items": [{"producto": producto.id, "cantidad": 2}]},
            format="json",
        )
        assert r1.status_code == 201
        orden_id = r1.data["id"]
        assert len(r1.data["detalles"]) == 1

        # segunda ronda
        r2 = client.post(
            f"/api/mesas/qr/{mesa.id}/pedido/",
            {"items": [{"producto": producto.id, "cantidad": 1}]},
            format="json",
        )
        assert r2.status_code == 201
        assert r2.data["id"] == orden_id
        assert len(r2.data["detalles"]) == 2

        # el estado ahora refleja el pedido completo
        r_estado = client.get(f"/api/mesas/qr/{mesa.id}/")
        assert r_estado.data["orden"]["id"] == orden_id
        assert len(r_estado.data["orden"]["detalles"]) == 2

        # solicitar cobro
        r_cobro = client.post(
            f"/api/mesas/qr/{mesa.id}/solicitar-cobro/",
            {"metodo_pago_sugerido": "efectivo"},
            format="json",
        )
        assert r_cobro.status_code == 201
        assert SolicitudCobro.objects.filter(orden_id=orden_id).exists()

    def test_solicitar_cobro_sin_orden_rechaza(self):
        mesa = MesaFactory()
        client = APIClient()
        r = client.post(
            f"/api/mesas/qr/{mesa.id}/solicitar-cobro/",
            {"metodo_pago_sugerido": "efectivo"},
            format="json",
        )
        assert r.status_code == 400

    def test_mesa_inactiva_da_404(self):
        mesa = MesaFactory(activo=False)
        client = APIClient()
        r = client.get(f"/api/mesas/qr/{mesa.id}/")
        assert r.status_code == 404


class TestThrottlePorMesa:
    """El limite de pedido_qr es por mesa, no por IP: en el wifi de la
    cafeteria varios clientes reales pueden compartir la misma IP publica
    (NAT), y no queremos que se agoten el balde entre ellos."""

    def setup_method(self):
        cache.clear()

    def test_agotar_el_limite_de_una_mesa_no_afecta_a_otra(self):
        mesa1 = MesaFactory()
        mesa2 = MesaFactory()
        client = APIClient()  # mismo cliente/IP para las dos mesas

        for _ in range(20):
            r = client.get(f"/api/mesas/qr/{mesa1.id}/")
            assert r.status_code == 200

        r_bloqueado = client.get(f"/api/mesas/qr/{mesa1.id}/")
        assert r_bloqueado.status_code == 429

        r_mesa2 = client.get(f"/api/mesas/qr/{mesa2.id}/")
        assert r_mesa2.status_code == 200
