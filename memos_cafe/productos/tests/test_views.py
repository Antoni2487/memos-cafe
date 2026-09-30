from datetime import timedelta
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.utils import timezone
from rest_framework.test import APIClient

from memos_cafe.productos.tests.factories import CategoriaFactory
from memos_cafe.productos.tests.factories import ProductoFactory
from memos_cafe.productos.tests.factories import PromocionFactory

pytestmark = pytest.mark.django_db


@pytest.fixture
def admin_client(db):
    user_model = get_user_model()
    grupo, _ = Group.objects.get_or_create(name="admin")
    user = user_model.objects.create_user(email="admin@test.com", password="pass123")
    user.groups.add(grupo)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def user_client(db):
    user_model = get_user_model()
    user = user_model.objects.create_user(email="user@test.com", password="pass123")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def anon_client():
    return APIClient()


class TestCategoriaViewSet:
    def test_listar_autenticado(self, user_client):
        CategoriaFactory.create_batch(3)
        r = user_client.get("/api/productos/categorias/")
        assert r.status_code == 200

    def test_listar_anonimo_rechazado(self, anon_client):
        r = anon_client.get("/api/productos/categorias/")
        assert r.status_code == 401

    def test_crear_como_admin(self, admin_client):
        r = admin_client.post("/api/productos/categorias/crear/", {"nombre": "Postres"})
        assert r.status_code == 201
        assert r.data["nombre"] == "Postres"

    def test_crear_como_usuario_rechazado(self, user_client):
        r = user_client.post("/api/productos/categorias/crear/", {"nombre": "X"})
        assert r.status_code == 403

    def test_crear_nombre_duplicado(self, admin_client):
        CategoriaFactory(nombre="Bebidas")
        r = admin_client.post("/api/productos/categorias/crear/", {"nombre": "Bebidas"})
        assert r.status_code == 400

    def test_desactivar_con_productos_rechazado(self, admin_client):
        cat = CategoriaFactory()
        ProductoFactory(categoria=cat, disponible=True)
        r = admin_client.post(f"/api/productos/categorias/{cat.id}/desactivar/")
        assert r.status_code == 400


class TestProductoViewSet:
    def test_listar_autenticado(self, user_client):
        ProductoFactory.create_batch(3)
        r = user_client.get("/api/productos/")
        assert r.status_code == 200

    def test_listar_anonimo_rechazado(self, anon_client):
        r = anon_client.get("/api/productos/")
        assert r.status_code == 401

    def test_crear_como_admin(self, admin_client):
        cat = CategoriaFactory()
        r = admin_client.post(
            "/api/productos/crear/",
            {
                "nombre": "Espresso",
                "precio": "8.50",
                "categoria": cat.id,
            },
        )
        assert r.status_code == 201
        assert r.data["nombre"] == "Espresso"

    def test_crear_como_usuario_rechazado(self, user_client):
        cat = CategoriaFactory()
        r = user_client.post(
            "/api/productos/crear/",
            {
                "nombre": "X",
                "precio": "5.00",
                "categoria": cat.id,
            },
        )
        assert r.status_code == 403

    def test_crear_precio_invalido(self, admin_client):
        cat = CategoriaFactory()
        r = admin_client.post(
            "/api/productos/crear/",
            {
                "nombre": "X",
                "precio": "0",
                "categoria": cat.id,
            },
        )
        assert r.status_code == 400

    def test_activar_producto(self, admin_client):
        p = ProductoFactory(disponible=False)
        r = admin_client.post(f"/api/productos/{p.id}/activar/")
        assert r.status_code == 200
        assert r.data["disponible"] is True

    def test_desactivar_producto(self, admin_client):
        p = ProductoFactory(disponible=True)
        r = admin_client.post(f"/api/productos/{p.id}/desactivar/")
        assert r.status_code == 200
        assert r.data["disponible"] is False

    def test_actualizar_precio(self, admin_client):
        p = ProductoFactory(precio=Decimal("10.00"))
        r = admin_client.patch(f"/api/productos/{p.id}/precio/", {"precio": "25.00"})
        assert r.status_code == 200
        assert Decimal(r.data["precio"]) == Decimal("25.00")

    def test_actualizar_precio_invalido(self, admin_client):
        p = ProductoFactory()
        r = admin_client.patch(f"/api/productos/{p.id}/precio/", {"precio": "-1"})
        assert r.status_code == 400

    def test_producto_no_existe_retorna_404(self, admin_client):
        r = admin_client.get("/api/productos/99999/")
        assert r.status_code == 404

    def test_catalogo_publico_accesible_sin_login(self, anon_client):
        disponible = ProductoFactory(disponible=True)
        no_disponible = ProductoFactory(disponible=False)
        r = anon_client.get("/api/productos/publico/")
        assert r.status_code == 200
        ids = [p["id"] for p in r.data]
        assert disponible.id in ids
        assert no_disponible.id not in ids


class TestPromocionViewSet:
    def test_listar_autenticado(self, user_client):
        PromocionFactory.create_batch(2)
        r = user_client.get("/api/productos/promociones/")
        assert r.status_code == 200

    def test_crear_como_admin(self, admin_client):
        hoy = timezone.localdate()
        r = admin_client.post(
            "/api/productos/promociones/crear/",
            {
                "nombre": "Happy Hour",
                "precio": "12.00",
                "fecha_inicio": str(hoy),
                "fecha_fin": str(hoy + timedelta(days=5)),
            },
        )
        assert r.status_code == 201

    def test_crear_fechas_invalidas(self, admin_client):
        hoy = timezone.localdate()
        r = admin_client.post(
            "/api/productos/promociones/crear/",
            {
                "nombre": "X",
                "precio": "10.00",
                "fecha_inicio": str(hoy + timedelta(days=5)),
                "fecha_fin": str(hoy + timedelta(days=1)),
            },
        )
        assert r.status_code == 400

    def test_activar_promocion(self, admin_client):
        promo = PromocionFactory(activo=False)
        r = admin_client.post(f"/api/productos/promociones/{promo.id}/activar/")
        assert r.status_code == 200
        assert r.data["activo"] is True

    def test_catalogo_publico_accesible_sin_login(self, anon_client):
        vigente = PromocionFactory(activo=True)
        inactiva = PromocionFactory(activo=False)
        r = anon_client.get("/api/productos/promociones/publico/")
        assert r.status_code == 200
        ids = [p["id"] for p in r.data]
        assert vigente.id in ids
        assert inactiva.id not in ids
