"""Prueba el loop completo: auth JWT en el handshake -> rol correcto se une
al grupo -> DetalleOrdenService dispara el evento -> el consumer lo relaya.

database_sync_to_async corre las queries en un thread aparte, por eso estos
tests necesitan transaction=True (el wrapping atomico por-test default de
pytest-django no es visible entre threads)."""

import asyncio
from decimal import Decimal

import pytest
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import Group
from rest_framework_simplejwt.tokens import AccessToken

from memos_cafe.caja.tests.factories import CajaFactory, MesaFactory, OrdenFactory
from memos_cafe.mesas.models import Mesa
from memos_cafe.mesas.services import SesionMesaService
from memos_cafe.ordenes.models import DetalleOrden
from memos_cafe.ordenes.services import DetalleOrdenService, OrdenService
from memos_cafe.productos.tests.factories import ProductoFactory
from memos_cafe.realtime.middleware import JWTAuthMiddlewareStack
from memos_cafe.realtime.routing import websocket_urlpatterns
from memos_cafe.users.tests.factories import UserFactory

application = JWTAuthMiddlewareStack(URLRouter(websocket_urlpatterns))


def _token_de(user):
    return str(AccessToken.for_user(user))


def _usuario_con_rol(rol):
    grupo, _ = Group.objects.get_or_create(name=rol)
    user = UserFactory()
    user.groups.add(grupo)
    return user


def _crear_detalle_pendiente():
    CajaFactory()
    orden = OrdenFactory(mesa=MesaFactory())
    producto = ProductoFactory(precio=Decimal("10.00"))
    return DetalleOrdenService._crear_detalle(orden=orden, cantidad=1, producto=producto)


@pytest.mark.django_db(transaction=True)
def test_conexion_sin_token_se_rechaza():
    async def body():
        communicator = WebsocketCommunicator(application, "/ws/cocina/")
        connected, close_code = await communicator.connect()
        assert connected is False
        assert close_code == 4401
        await communicator.disconnect()

    asyncio.run(body())


@pytest.mark.django_db(transaction=True)
def test_mesero_no_puede_conectarse_a_cocina():
    async def body():
        user = await asyncio.to_thread(_usuario_con_rol, "mesero")
        token = await asyncio.to_thread(_token_de, user)
        communicator = WebsocketCommunicator(application, f"/ws/cocina/?token={token}")
        connected, close_code = await communicator.connect()
        assert connected is False
        assert close_code == 4403
        await communicator.disconnect()

    asyncio.run(body())


@pytest.mark.django_db(transaction=True)
def test_cocina_se_conecta_y_recibe_cambio_de_estado():
    async def body():
        cocina_user = await asyncio.to_thread(_usuario_con_rol, "cocina")
        token = await asyncio.to_thread(_token_de, cocina_user)
        communicator = WebsocketCommunicator(application, f"/ws/cocina/?token={token}")
        connected, _ = await communicator.connect()
        assert connected is True

        detalle = await asyncio.to_thread(_crear_detalle_pendiente)
        await asyncio.to_thread(
            DetalleOrdenService.actualizar_estado_preparacion,
            detalle,
            DetalleOrden.EstadoPreparacion.EN_PREPARACION,
        )

        evento = await communicator.receive_json_from(timeout=2)
        assert evento["detalle_id"] == detalle.id
        assert evento["estado_preparacion"] == "en_preparacion"

        await communicator.disconnect()

    asyncio.run(body())


def _crear_orden_mesa():
    CajaFactory()
    mesa = MesaFactory(estado=Mesa.Estado.LIBRE)
    usuario = UserFactory()
    producto = ProductoFactory(precio=Decimal("10.00"))
    return OrdenService.crear_orden(
        usuario=usuario, tipo_orden="mesa", mesa=mesa,
        detalles=[{"producto": producto, "cantidad": 1}],
    )


@pytest.mark.django_db(transaction=True)
def test_cocina_recibe_aviso_de_pedido_nuevo_al_crear_orden():
    async def body():
        cocina_user = await asyncio.to_thread(_usuario_con_rol, "cocina")
        token = await asyncio.to_thread(_token_de, cocina_user)
        communicator = WebsocketCommunicator(application, f"/ws/cocina/?token={token}")
        connected, _ = await communicator.connect()
        assert connected is True

        orden = await asyncio.to_thread(_crear_orden_mesa)

        evento = await communicator.receive_json_from(timeout=2)
        assert evento["type"] == "pedido.nuevo"
        assert evento["orden_id"] == orden.id
        assert evento["mesa_numero"] == orden.mesa.numero

        await communicator.disconnect()

    asyncio.run(body())


@pytest.mark.django_db(transaction=True)
def test_mesero_no_recibe_aviso_de_pedido_nuevo():
    """pedido.nuevo solo va al grupo 'cocina' — al mesero solo le importa
    la alerta de 'listo' (ver test_mesero_solo_recibe_alerta_cuando_el_item_pasa_a_listo)."""
    async def body():
        mesero_user = await asyncio.to_thread(_usuario_con_rol, "mesero")
        token = await asyncio.to_thread(_token_de, mesero_user)
        communicator = WebsocketCommunicator(application, f"/ws/meseros/?token={token}")
        connected, _ = await communicator.connect()
        assert connected is True

        await asyncio.to_thread(_crear_orden_mesa)

        assert await communicator.receive_nothing(timeout=0.5) is True
        await communicator.disconnect()

    asyncio.run(body())


@pytest.mark.django_db(transaction=True)
def test_admin_tambien_puede_conectarse_a_cocina():
    async def body():
        admin_user = await asyncio.to_thread(_usuario_con_rol, "admin")
        token = await asyncio.to_thread(_token_de, admin_user)
        communicator = WebsocketCommunicator(application, f"/ws/cocina/?token={token}")
        connected, _ = await communicator.connect()
        assert connected is True
        await communicator.disconnect()

    asyncio.run(body())


@pytest.mark.django_db(transaction=True)
def test_mesero_solo_recibe_alerta_cuando_el_item_pasa_a_listo():
    async def body():
        mesero_user = await asyncio.to_thread(_usuario_con_rol, "mesero")
        token = await asyncio.to_thread(_token_de, mesero_user)
        communicator = WebsocketCommunicator(application, f"/ws/meseros/?token={token}")
        connected, _ = await communicator.connect()
        assert connected is True

        detalle = await asyncio.to_thread(_crear_detalle_pendiente)

        # pendiente -> en_preparacion: no es "listo", el mesero no debe ver nada.
        await asyncio.to_thread(
            DetalleOrdenService.actualizar_estado_preparacion,
            detalle,
            DetalleOrden.EstadoPreparacion.EN_PREPARACION,
        )
        assert await communicator.receive_nothing(timeout=0.5) is True

        # en_preparacion -> listo: ahora si.
        await asyncio.to_thread(
            DetalleOrdenService.actualizar_estado_preparacion,
            detalle,
            DetalleOrden.EstadoPreparacion.LISTO,
        )
        evento = await communicator.receive_json_from(timeout=2)
        assert evento["estado_preparacion"] == "listo"
        assert evento["nombre"]
        assert evento["mesa_numero"] == detalle.orden.mesa.numero

        await communicator.disconnect()

    asyncio.run(body())


@pytest.mark.django_db(transaction=True)
def test_cajero_puede_conectarse_a_meseros():
    """ws/meseros/ ahora tambien acepta cajero: el cliente puede pedir la
    cuenta con un metodo que cobra el cajero en caja, no solo el mesero
    con el POS en la mesa."""
    async def body():
        cajero_user = await asyncio.to_thread(_usuario_con_rol, "cajero")
        token = await asyncio.to_thread(_token_de, cajero_user)
        communicator = WebsocketCommunicator(application, f"/ws/meseros/?token={token}")
        connected, _ = await communicator.connect()
        assert connected is True
        await communicator.disconnect()

    asyncio.run(body())


@pytest.mark.django_db(transaction=True)
def test_mesero_y_cajero_reciben_solicitud_de_cobro():
    async def body():
        mesero_user = await asyncio.to_thread(_usuario_con_rol, "mesero")
        cajero_user = await asyncio.to_thread(_usuario_con_rol, "cajero")
        token_mesero = await asyncio.to_thread(_token_de, mesero_user)
        token_cajero = await asyncio.to_thread(_token_de, cajero_user)

        comm_mesero = WebsocketCommunicator(application, f"/ws/meseros/?token={token_mesero}")
        comm_cajero = WebsocketCommunicator(application, f"/ws/meseros/?token={token_cajero}")
        assert (await comm_mesero.connect())[0] is True
        assert (await comm_cajero.connect())[0] is True

        orden = await asyncio.to_thread(_crear_orden_mesa)
        await asyncio.to_thread(SesionMesaService.solicitar_cobro, orden.mesa, "yape")

        for comm in (comm_mesero, comm_cajero):
            evento = await comm.receive_json_from(timeout=2)
            assert evento["type"] == "solicitud_cobro.nueva"
            assert evento["mesa_numero"] == orden.mesa.numero
            assert evento["metodo_pago_sugerido"] == "yape"

        await comm_mesero.disconnect()
        await comm_cajero.disconnect()

    asyncio.run(body())
