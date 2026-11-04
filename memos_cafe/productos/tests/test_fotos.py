"""Galería de fotos de un producto: portada (Producto.imagen) + fotos extra."""

from io import BytesIO

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test.utils import CaptureQueriesContext
from PIL import Image
from rest_framework.test import APIClient

from memos_cafe.productos.models import ProductoImagen
from memos_cafe.productos.services import MAX_FOTOS_POR_PRODUCTO
from memos_cafe.productos.services import FotoProductoService
from memos_cafe.productos.tests.factories import ProductoFactory

pytestmark = pytest.mark.django_db


def png(nombre="foto.png"):
    buffer = BytesIO()
    Image.new("RGB", (4, 4), (76, 107, 101)).save(buffer, format="PNG")
    return SimpleUploadedFile(nombre, buffer.getvalue(), content_type="image/png")


@pytest.fixture
def admin_client(db):
    grupo, _ = Group.objects.get_or_create(name="admin")
    user = get_user_model().objects.create_user(email="a@test.com", password="x")
    user.groups.add(grupo)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def user_client(db):
    user = get_user_model().objects.create_user(email="u@test.com", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def con_fotos(n):
    """Producto con portada y n fotos adicionales."""
    producto = ProductoFactory(imagen=png("portada.png"))
    for _ in range(n):
        FotoProductoService.agregar(producto, png())
    return producto


class TestFotoProductoService:
    def test_primera_foto_sin_portada_pasa_a_portada(self):
        producto = ProductoFactory()
        FotoProductoService.agregar(producto, png())
        producto.refresh_from_db()
        assert producto.imagen
        assert producto.fotos.count() == 0

    def test_fotos_siguientes_quedan_en_orden(self):
        producto = con_fotos(3)
        assert list(producto.fotos.values_list("orden", flat=True)) == [0, 1, 2]

    def test_tope_de_fotos(self):
        producto = con_fotos(MAX_FOTOS_POR_PRODUCTO - 1)
        with pytest.raises(ValueError, match="hasta"):
            FotoProductoService.agregar(producto, png())
        assert FotoProductoService.total(producto) == MAX_FOTOS_POR_PRODUCTO

    def test_ordenar(self):
        producto = con_fotos(3)
        ids = list(producto.fotos.values_list("id", flat=True))
        FotoProductoService.ordenar(producto, list(reversed(ids)))
        assert list(producto.fotos.values_list("id", flat=True)) == list(reversed(ids))

    @pytest.mark.parametrize("cambio", ["falta", "sobra", "repetida"])
    def test_ordenar_rechaza_lista_incompleta_o_ajena(self, cambio):
        producto = con_fotos(2)
        otra = con_fotos(1).fotos.first()
        ids = list(producto.fotos.values_list("id", flat=True))
        lista = {
            "falta": ids[:1],
            "sobra": [*ids, otra.id],
            "repetida": [ids[0], ids[0]],
        }[cambio]
        with pytest.raises(ValueError, match="una sola vez"):
            FotoProductoService.ordenar(producto, lista)

    def test_hacer_portada_intercambia_archivos(self):
        producto = con_fotos(1)
        foto = producto.fotos.first()
        portada, nueva = producto.imagen.name, foto.imagen.name
        FotoProductoService.hacer_portada(producto, foto.id)
        producto.refresh_from_db()
        foto.refresh_from_db()
        assert producto.imagen.name == nueva
        assert foto.imagen.name == portada

    def test_hacer_portada_de_otro_producto_falla(self):
        producto = con_fotos(0)
        ajena = con_fotos(1).fotos.first()
        with pytest.raises(ValueError, match="no existe"):
            FotoProductoService.hacer_portada(producto, ajena.id)

    def test_quitar_portada_sube_la_primera_foto(self):
        producto = con_fotos(2)
        primera = producto.fotos.first()
        nombre = primera.imagen.name
        FotoProductoService.quitar_portada(producto)
        producto.refresh_from_db()
        assert producto.imagen.name == nombre
        assert producto.fotos.count() == 1

    def test_quitar_portada_sin_fotos_deja_el_producto_sin_imagen(self):
        producto = con_fotos(0)
        FotoProductoService.quitar_portada(producto)
        producto.refresh_from_db()
        assert not producto.imagen

    def test_eliminar(self):
        producto = con_fotos(2)
        FotoProductoService.eliminar(producto, producto.fotos.first().id)
        assert producto.fotos.count() == 1


class TestFotosApi:
    def test_subir_foto_devuelve_la_galeria(self, admin_client):
        producto = con_fotos(0)
        r = admin_client.post(
            f"/api/productos/{producto.id}/fotos/",
            {"imagen": png()},
            format="multipart",
        )
        assert r.status_code == 201
        assert len(r.data["fotos"]) == 1
        assert r.data["fotos"][0]["imagen"].startswith("http")

    def test_subir_foto_requiere_admin(self, user_client):
        producto = con_fotos(0)
        r = user_client.post(
            f"/api/productos/{producto.id}/fotos/",
            {"imagen": png()},
            format="multipart",
        )
        assert r.status_code == 403
        assert producto.fotos.count() == 0

    def test_subir_algo_que_no_es_imagen(self, admin_client):
        producto = con_fotos(0)
        archivo = SimpleUploadedFile("x.png", b"no soy png", content_type="image/png")
        r = admin_client.post(
            f"/api/productos/{producto.id}/fotos/",
            {"imagen": archivo},
            format="multipart",
        )
        assert r.status_code == 400

    def test_tope_responde_400(self, admin_client):
        producto = con_fotos(MAX_FOTOS_POR_PRODUCTO - 1)
        r = admin_client.post(
            f"/api/productos/{producto.id}/fotos/",
            {"imagen": png()},
            format="multipart",
        )
        assert r.status_code == 400

    def test_ordenar(self, admin_client):
        producto = con_fotos(2)
        ids = list(producto.fotos.values_list("id", flat=True))
        r = admin_client.post(
            f"/api/productos/{producto.id}/fotos/ordenar/",
            {"orden": list(reversed(ids))},
            format="json",
        )
        assert r.status_code == 200
        assert [f["id"] for f in r.data["fotos"]] == list(reversed(ids))

    def test_hacer_portada(self, admin_client):
        producto = con_fotos(1)
        foto = producto.fotos.first()
        r = admin_client.post(f"/api/productos/{producto.id}/fotos/{foto.id}/portada/")
        assert r.status_code == 200
        assert r.data["imagen"].endswith(foto.imagen.name)

    def test_eliminar_foto_ajena_es_404(self, admin_client):
        producto = con_fotos(0)
        ajena = con_fotos(1).fotos.first()
        r = admin_client.delete(f"/api/productos/{producto.id}/fotos/{ajena.id}/")
        assert r.status_code == 404
        assert ProductoImagen.objects.filter(pk=ajena.pk).exists()

    def test_quitar_portada(self, admin_client):
        producto = con_fotos(1)
        r = admin_client.delete(f"/api/productos/{producto.id}/fotos/portada/")
        assert r.status_code == 200
        assert r.data["fotos"] == []

    def test_carta_publica_incluye_fotos_sin_consultas_por_producto(self):
        client = APIClient()

        def consultas_carta():
            with CaptureQueriesContext(connection) as consultas:
                r = client.get("/api/productos/publico/")
            assert r.status_code == 200
            assert all(len(p["fotos"]) == 2 for p in r.data)
            return len(consultas)

        con_fotos(2)
        con_uno = consultas_carta()
        for _ in range(3):
            con_fotos(2)
        # Las fotos llegan con prefetch: no hay una consulta extra por producto.
        assert consultas_carta() == con_uno
