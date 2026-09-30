"""Croquis del salon: el admin arma el plano (mesas, barra, paredes) y lo
cambia cuando quiera; el mesero lo ve con lo que pasa en cada mesa."""

from datetime import timedelta
from decimal import Decimal
from http import HTTPStatus

import pytest
from django.contrib.auth.models import Group
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APIClient

from memos_cafe.caja.models import SolicitudCobro
from memos_cafe.caja.tests.factories import CajaFactory
from memos_cafe.caja.tests.factories import MesaFactory
from memos_cafe.mesas.models import ElementoPlano
from memos_cafe.mesas.models import Mesa
from memos_cafe.mesas.services import MesaService
from memos_cafe.mesas.services import PlanoService
from memos_cafe.ordenes.models import Comanda
from memos_cafe.ordenes.services import ComandaService
from memos_cafe.ordenes.services import OrdenService
from memos_cafe.productos.tests.factories import ProductoFactory
from memos_cafe.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db

URL = "/api/mesas/plano/"


def _cliente(rol):
    usuario = UserFactory(name=f"Ana {rol}")
    usuario.groups.add(Group.objects.get_or_create(name=rol)[0])
    client = APIClient()
    client.force_authenticate(user=usuario)
    return client, usuario


def _por_numero(data, numero):
    return next(m for m in data["mesas"] if m["numero"] == numero)


class TestEditor:
    def test_guardar_posiciones_y_elementos(self):
        m1 = MesaFactory(numero=1)
        m2 = MesaFactory(numero=2)
        admin, _ = _cliente("admin")

        r = admin.put(
            URL,
            {
                "mesas": [
                    {"id": m1.id, "plano_x": 300, "plano_y": 120, "forma": "redonda"},
                    {
                        "id": m2.id,
                        "plano_x": 450,
                        "plano_y": 120,
                        "forma": "rectangular",
                        "plano_ancho": 120,
                        "plano_alto": 70,
                        "rotacion": 90,
                    },
                ],
                "elementos": [
                    {
                        "tipo": "barra",
                        "etiqueta": "Barra",
                        "forma": "redonda",
                        "plano_x": 90,
                        "plano_y": 320,
                        "plano_ancho": 120,
                        "plano_alto": 420,
                    },
                    {
                        "tipo": "pared",
                        "plano_x": 200,
                        "plano_y": 320,
                        "plano_ancho": 8,
                        "plano_alto": 10,
                    },
                ],
            },
            format="json",
        )

        assert r.status_code == HTTPStatus.OK, r.data
        m2.refresh_from_db()
        assert (m2.plano_x, m2.plano_ancho, m2.forma, m2.rotacion) == (
            450,
            120,
            "rectangular",
            90,
        )
        assert [e["tipo"] for e in r.data["elementos"]] == ["barra", "pared"]
        assert (r.data["ancho"], r.data["alto"]) == (1000, 640)

    def test_los_elementos_que_no_vienen_se_borran(self):
        queda = ElementoPlano.objects.create(
            tipo="barra",
            plano_x=10,
            plano_y=10,
            plano_ancho=50,
            plano_alto=50,
        )
        ElementoPlano.objects.create(
            tipo="texto",
            etiqueta="Terraza",
            plano_x=10,
            plano_y=10,
            plano_ancho=50,
            plano_alto=20,
        )
        admin, _ = _cliente("admin")

        r = admin.put(
            URL,
            {
                "mesas": [],
                "elementos": [
                    {
                        "id": queda.id,
                        "tipo": "barra",
                        "etiqueta": "Barra",
                        "plano_x": 99,
                        "plano_y": 10,
                        "plano_ancho": 50,
                        "plano_alto": 50,
                    },
                ],
            },
            format="json",
        )

        assert r.status_code == HTTPStatus.OK
        (elemento,) = ElementoPlano.objects.all()
        assert (elemento.id, elemento.plano_x, elemento.etiqueta) == (
            queda.id,
            99,
            "Barra",
        )

    def test_fuera_del_lienzo_no(self):
        mesa = MesaFactory()
        admin, _ = _cliente("admin")

        r = admin.put(
            URL,
            {
                "mesas": [{"id": mesa.id, "plano_x": 5000, "plano_y": 10}],
                "elementos": [],
            },
            format="json",
        )

        assert r.status_code == HTTPStatus.BAD_REQUEST

    def test_mesa_dada_de_baja_no_se_ubica(self):
        mesa = MesaFactory(activo=False)
        admin, _ = _cliente("admin")

        r = admin.put(
            URL,
            {"mesas": [{"id": mesa.id, "plano_x": 10, "plano_y": 10}], "elementos": []},
            format="json",
        )

        assert r.status_code == HTTPStatus.BAD_REQUEST

    def test_solo_el_admin_edita(self):
        mesero, _ = _cliente("mesero")
        r = mesero.put(URL, {"mesas": [], "elementos": []}, format="json")
        assert r.status_code == HTTPStatus.FORBIDDEN


class TestAgregarYQuitarMesas:
    def test_agregar_una_mesa_ya_ubicada(self):
        admin, _ = _cliente("admin")

        r = admin.post(
            "/api/mesas/",
            {
                "numero": 11,
                "capacidad": 2,
                "plano_x": 800,
                "plano_y": 500,
                "forma": "rectangular",
            },
            format="json",
        )

        assert r.status_code == HTTPStatus.CREATED, r.data
        mesa = Mesa.objects.get(numero=11)
        assert (mesa.plano_x, mesa.plano_y, mesa.forma) == (800, 500, "rectangular")

    def test_quitar_y_volver_a_poner_una_mesa_conserva_su_qr(self):
        mesa = MesaFactory(numero=7)
        qr = mesa.codigo_qr
        admin, _ = _cliente("admin")

        assert (
            admin.delete(f"/api/mesas/{mesa.id}/").status_code == HTTPStatus.NO_CONTENT
        )
        assert all(m["numero"] != 7 for m in admin.get(URL).data["mesas"])

        r = admin.post("/api/mesas/", {"numero": 7, "capacidad": 6}, format="json")

        assert r.status_code == HTTPStatus.CREATED, r.data
        mesa.refresh_from_db()
        assert (mesa.activo, mesa.capacidad, mesa.codigo_qr) == (True, 6, qr)
        assert Mesa.objects.filter(numero=7).count() == 1

    def test_no_se_repite_el_numero_de_una_mesa_activa(self):
        MesaFactory(numero=3)
        admin, _ = _cliente("admin")

        r = admin.post("/api/mesas/", {"numero": 3, "capacidad": 2}, format="json")

        assert r.status_code == HTTPStatus.BAD_REQUEST

    def test_siguiente_numero_llena_huecos(self):
        for n in (1, 2, 4):
            MesaFactory(numero=n)
        assert MesaService.siguiente_numero() == 3
        admin, _ = _cliente("admin")
        assert admin.get(URL).data["siguiente_numero"] == 3

    def test_mover_una_mesa_desde_su_ficha(self):
        mesa = MesaFactory(numero=5)
        admin, _ = _cliente("admin")

        r = admin.patch(f"/api/mesas/{mesa.id}/", {"plano_x": 40}, format="json")

        assert r.status_code == HTTPStatus.OK, r.data
        mesa.refresh_from_db()
        assert mesa.plano_x == 40


class TestVistaDelMesero:
    @pytest.fixture(autouse=True)
    def _caja(self):
        cache.clear()
        CajaFactory()

    def test_mesa_libre_sin_datos_de_sala(self):
        MesaFactory(numero=1)
        mesero, _ = _cliente("mesero")

        r = mesero.get(URL)

        assert r.status_code == HTTPStatus.OK
        assert _por_numero(r.data, 1)["sala"] is None

    def test_mesa_ocupada_con_su_orden_y_comandas(self):
        mesa = MesaFactory(numero=4)
        mesero, usuario = _cliente("mesero")
        orden = OrdenService.crear_orden(
            usuario=usuario,
            tipo_orden="mesa",
            mesa=mesa,
            detalles=[
                {"producto": ProductoFactory(precio=Decimal("8.00")), "cantidad": 2},
            ],
        )
        ComandaService.marcar_lista(orden.comandas.get())
        SolicitudCobro.objects.create(orden=orden, metodo_pago_sugerido="efectivo")

        r = mesero.get(URL)

        sala = _por_numero(r.data, 4)["sala"]
        assert sala["orden_id"] == orden.id
        assert sala["total"] == "16.00"
        assert sala["mesero"] == usuario.name
        assert sala["comandas"][Comanda.Estado.LISTA] == 1
        assert sala["comanda_esperando_desde"] is not None
        assert sala["pide_cuenta"] is True

    def test_primer_pedido_qr_esperando(self):
        mesa = MesaFactory(numero=9, estado=Mesa.Estado.LIBRE)
        producto = ProductoFactory()
        APIClient().post(
            f"/api/mesas/qr/{mesa.codigo_qr}/pedido/",
            {"items": [{"producto": producto.id, "cantidad": 1}]},
            format="json",
        )
        mesero, _ = _cliente("mesero")

        sala = _por_numero(mesero.get(URL).data, 9)["sala"]

        assert sala["orden_id"] is None
        assert sala["pedido_por_confirmar_id"] is not None

    def test_consultas_constantes(self, django_assert_max_num_queries):
        mesero, usuario = _cliente("mesero")
        for n in range(1, 7):
            OrdenService.crear_orden(
                usuario=usuario,
                tipo_orden="mesa",
                mesa=MesaFactory(numero=n),
                detalles=[{"producto": ProductoFactory(), "cantidad": 1}],
            )

        with django_assert_max_num_queries(12):
            r = mesero.get(URL)
        assert len(r.data["mesas"]) == 6

    def test_cocina_no_ve_el_plano(self):
        cocina, _ = _cliente("cocina")
        assert cocina.get(URL).status_code == HTTPStatus.FORBIDDEN


def test_hora_de_espera_es_la_comanda_mas_antigua_sin_entregar():
    CajaFactory()
    _, usuario = _cliente("mesero")
    orden = OrdenService.crear_orden(
        usuario=usuario,
        tipo_orden="mesa",
        mesa=MesaFactory(),
        detalles=[{"producto": ProductoFactory(), "cantidad": 1}],
    )
    hace = timezone.now() - timedelta(minutes=15)
    orden.comandas.update(creada_en=hace)

    assert PlanoService.resumen_sala()[orden.mesa_id]["comanda_esperando_desde"] == hace
