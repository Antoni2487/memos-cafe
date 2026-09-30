"""Comandas: cada envio a Cocina, con su reloj (recibida, iniciada, lista,
entregada) y sus avisos en tiempo real."""

from datetime import timedelta
from decimal import Decimal
from http import HTTPStatus

import pytest
from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework.test import APIClient

from memos_cafe.caja.models import Caja
from memos_cafe.caja.tests.factories import CajaFactory
from memos_cafe.caja.tests.factories import MesaFactory
from memos_cafe.mesas.models import Mesa
from memos_cafe.ordenes.models import Comanda
from memos_cafe.ordenes.models import DetalleOrden
from memos_cafe.ordenes.models import Orden
from memos_cafe.ordenes.services import ComandaService
from memos_cafe.ordenes.services import DetalleOrdenService
from memos_cafe.ordenes.services import OrdenService
from memos_cafe.productos.tests.factories import ProductoFactory
from memos_cafe.realtime import notificar as notificar_mod
from memos_cafe.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

ITEM = DetalleOrden.EstadoPreparacion


@pytest.fixture
def enviados(monkeypatch):
    """Eventos en tiempo real enviados (se ejecutan al confirmar)."""
    lista = []
    monkeypatch.setattr(
        notificar_mod,
        "_enviar",
        lambda grupos, evento: lista.append((tuple(grupos), evento["type"])),
    )
    return lista


def _orden(cantidad_items=2, **kwargs):
    if not Caja.objects.get_sesion_abierta():
        CajaFactory()
    detalles = [
        {"producto": ProductoFactory(precio=Decimal("10.00")), "cantidad": 1}
        for _ in range(cantidad_items)
    ]
    return OrdenService.crear_orden(
        usuario=UserFactory(),
        tipo_orden="mesa",
        mesa=MesaFactory(estado=Mesa.Estado.LIBRE),
        detalles=detalles,
        **kwargs,
    )


def _cliente(rol):
    usuario = UserFactory()
    usuario.groups.add(Group.objects.get_or_create(name=rol)[0])
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client


class TestCreacion:
    def test_crear_orden_abre_la_comanda_1_con_todos_los_items(self):
        orden = _orden(cantidad_items=3)

        comanda = orden.comandas.get()
        assert comanda.numero == 1
        assert comanda.origen == Comanda.Origen.MESERO
        assert comanda.estado == Comanda.Estado.PENDIENTE
        assert comanda.detalles.count() == 3

    def test_una_orden_nueva_suena_una_sola_vez(
        self,
        enviados,
        django_capture_on_commit_callbacks,
    ):
        with django_capture_on_commit_callbacks(execute=True):
            _orden(cantidad_items=5)

        assert enviados == [(("cocina",), "pedido.nuevo")]

    def test_items_sueltos_del_mesero_se_suman_a_la_comanda_sin_empezar(self):
        orden = _orden()
        producto = ProductoFactory()

        DetalleOrdenService.agregar_detalle(orden=orden, cantidad=1, producto=producto)

        assert orden.comandas.count() == 1
        assert orden.comandas.get().detalles.count() == 3

    def test_si_la_comanda_ya_se_empezo_el_item_abre_una_nueva(self):
        orden = _orden()
        ComandaService.iniciar(orden.comandas.get())

        detalle = DetalleOrdenService.agregar_detalle(
            orden=orden,
            cantidad=1,
            producto=ProductoFactory(),
        )

        assert detalle.comanda.numero == 2
        assert detalle.ronda == 2

    def test_una_ronda_por_qr_es_una_comanda_con_un_solo_aviso(
        self,
        enviados,
        django_capture_on_commit_callbacks,
    ):
        orden = _orden()
        items = [{"producto": ProductoFactory(), "cantidad": 2} for _ in range(3)]

        with django_capture_on_commit_callbacks(execute=True):
            comanda = DetalleOrdenService.agregar_ronda(
                orden,
                items,
                origen=Comanda.Origen.QR,
            )

        assert comanda.numero == 2
        assert comanda.origen == Comanda.Origen.QR
        assert comanda.detalles.count() == 3
        assert enviados == [(("cocina",), "pedido.nuevo")]

    def test_borrar_el_ultimo_item_borra_la_comanda(self):
        orden = _orden(cantidad_items=1)
        detalle = orden.detalles.get()

        DetalleOrdenService.eliminar_detalle(orden, detalle.id)

        assert not orden.comandas.exists()


class TestCicloYTiempos:
    def test_iniciar_registra_la_hora_y_pasa_los_items_a_preparacion(self):
        comanda = _orden().comandas.get()

        comanda = ComandaService.iniciar(comanda)

        assert comanda.estado == Comanda.Estado.EN_PREPARACION
        assert comanda.iniciada_en is not None
        assert set(comanda.detalles.values_list("estado_preparacion", flat=True)) == {
            ITEM.EN_PREPARACION,
        }

    def test_no_se_puede_iniciar_dos_veces(self):
        comanda = ComandaService.iniciar(_orden().comandas.get())
        with pytest.raises(ValueError, match="ya se empezo"):
            ComandaService.iniciar(comanda)

    def test_marcar_un_item_empieza_la_comanda_pero_no_la_cierra(self):
        comanda = _orden(cantidad_items=1).comandas.get()
        detalle = comanda.detalles.get()

        ComandaService.marcar_item(detalle, listo=True)

        comanda.refresh_from_db()
        assert comanda.estado == Comanda.Estado.EN_PREPARACION
        assert comanda.iniciada_en is not None
        detalle.refresh_from_db()
        assert detalle.estado_preparacion == ITEM.LISTO

    def test_desmarcar_un_item_lo_devuelve_a_preparacion(self):
        detalle = _orden(cantidad_items=1).comandas.get().detalles.get()
        ComandaService.marcar_item(detalle, listo=True)

        ComandaService.marcar_item(detalle, listo=False)

        detalle.refresh_from_db()
        assert detalle.estado_preparacion == ITEM.EN_PREPARACION

    def test_marcar_lista_avisa_a_cocina_y_meseros(
        self,
        enviados,
        django_capture_on_commit_callbacks,
    ):
        comanda = ComandaService.iniciar(_orden().comandas.get())

        with django_capture_on_commit_callbacks(execute=True):
            comanda = ComandaService.marcar_lista(comanda)

        assert comanda.estado == Comanda.Estado.LISTA
        assert comanda.lista_en is not None
        assert enviados == [(("cocina", "meseros"), "comanda.actualizada")]

    def test_entregar_exige_que_este_lista(self):
        comanda = _orden().comandas.get()
        with pytest.raises(ValueError, match="todavia no esta lista"):
            ComandaService.entregar(comanda)

        ComandaService.marcar_lista(comanda)
        comanda = ComandaService.entregar(comanda)

        assert comanda.estado == Comanda.Estado.ENTREGADA
        assert comanda.entregada_en is not None
        assert set(comanda.detalles.values_list("estado_preparacion", flat=True)) == {
            ITEM.ENTREGADO,
        }

    def test_tiempos_de_espera_y_preparacion(self):
        comanda = _orden().comandas.get()
        comanda.iniciada_en = comanda.creada_en + timedelta(minutes=3)
        comanda.lista_en = comanda.iniciada_en + timedelta(minutes=12)

        assert comanda.segundos_espera == 3 * 60
        assert comanda.segundos_preparacion == 12 * 60

    def test_el_flujo_por_item_actualiza_la_comanda(self):
        """La pantalla de Cocina actual avanza item por item."""
        comanda = _orden(cantidad_items=2).comandas.get()
        d1, d2 = comanda.detalles.all()

        DetalleOrdenService.actualizar_estado_preparacion(d1, ITEM.EN_PREPARACION)
        comanda.refresh_from_db()
        assert comanda.estado == Comanda.Estado.EN_PREPARACION

        for d in (d1, d2):
            d.refresh_from_db()
            if d.estado_preparacion == ITEM.PENDIENTE:
                DetalleOrdenService.actualizar_estado_preparacion(
                    d,
                    ITEM.EN_PREPARACION,
                )
            DetalleOrdenService.actualizar_estado_preparacion(d, ITEM.LISTO)
        comanda.refresh_from_db()
        assert comanda.estado == Comanda.Estado.LISTA
        assert comanda.lista_en is not None


class TestApi:
    def test_el_listado_de_ordenes_sigue_funcionando(self):
        """Las rutas de comandas van antes que las de ordenes: que no tapen
        el listado ni el detalle de una orden."""
        orden = _orden()
        admin = _cliente("admin")

        assert admin.get("/api/ordenes/").status_code == HTTPStatus.OK
        assert admin.get(f"/api/ordenes/{orden.id}/").status_code == HTTPStatus.OK

    def test_tablero_de_cocina_por_comanda(self):
        orden = _orden(cantidad_items=2)
        entregada = DetalleOrdenService.agregar_ronda(
            orden,
            [{"producto": ProductoFactory(), "cantidad": 1}],
            origen=Comanda.Origen.QR,
        )
        ComandaService.marcar_lista(entregada)
        ComandaService.entregar(entregada)
        cerrada = _orden()
        Orden.objects.filter(pk=cerrada.pk).update(estado=Orden.Estado.CERRADA)

        r = _cliente("cocina").get("/api/ordenes/comandas/cocina/")

        assert r.status_code == HTTPStatus.OK
        assert [(c["orden_id"], c["numero"]) for c in r.data] == [(orden.id, 1)]
        comanda = r.data[0]
        assert comanda["mesa_numero"] == orden.mesa.numero
        assert len(comanda["detalles"]) == 2
        assert "precio_unitario" not in comanda["detalles"][0]

    def test_cocina_inicia_marca_items_y_termina(self):
        comanda = _orden(cantidad_items=1).comandas.get()
        detalle = comanda.detalles.get()
        cocina = _cliente("cocina")
        base = f"/api/ordenes/comandas/{comanda.id}"

        r = cocina.post(f"{base}/iniciar/")
        assert r.status_code == HTTPStatus.OK
        assert r.data["estado"] == Comanda.Estado.EN_PREPARACION
        assert r.data["iniciada_en"] is not None

        r = cocina.post(
            f"{base}/items/{detalle.id}/check/",
            {"listo": True},
            format="json",
        )
        assert r.status_code == HTTPStatus.OK
        assert r.data["detalles"][0]["estado_preparacion"] == ITEM.LISTO

        r = cocina.post(f"{base}/lista/")
        assert r.data["estado"] == Comanda.Estado.LISTA

        assert cocina.post(f"{base}/iniciar/").status_code == HTTPStatus.BAD_REQUEST

    def test_el_mesero_entrega_pero_no_cocina(self):
        comanda = _orden().comandas.get()
        mesero = _cliente("mesero")

        assert (
            mesero.post(f"/api/ordenes/comandas/{comanda.id}/iniciar/").status_code
            == HTTPStatus.FORBIDDEN
        )
        ComandaService.marcar_lista(comanda)
        r = mesero.post(f"/api/ordenes/comandas/{comanda.id}/entregar/")
        assert r.status_code == HTTPStatus.OK
        assert r.data["estado"] == Comanda.Estado.ENTREGADA

    def test_segundos_segun_el_reloj_del_servidor(self):
        comanda = _orden().comandas.get()
        hace = timezone.now() - timedelta(minutes=12)
        Comanda.objects.filter(pk=comanda.pk).update(creada_en=hace, iniciada_en=hace)

        (tarjeta,) = _cliente("cocina").get("/api/ordenes/comandas/cocina/").data

        segundos = tarjeta["segundos"]
        assert 12 * 60 <= segundos["desde_creada"] < 12 * 60 + 5
        assert segundos["desde_lista"] is None
