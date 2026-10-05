from datetime import timedelta

import pytest
from django.utils import timezone

from memos_cafe.productos.api.serializers import CategoriaSerializer
from memos_cafe.productos.api.serializers import ProductoEditarSerializer
from memos_cafe.productos.api.serializers import ProductoWriteSerializer
from memos_cafe.productos.api.serializers import PromocionWriteSerializer
from memos_cafe.productos.tests.factories import CategoriaFactory

pytestmark = pytest.mark.django_db


class TestCategoriaSerializer:
    def test_valido(self):
        s = CategoriaSerializer(data={"nombre": "Bebidas", "activo": True})
        assert s.is_valid()

    def test_nombre_requerido(self):
        s = CategoriaSerializer(data={"activo": True})
        assert not s.is_valid()
        assert "nombre" in s.errors

    def test_nombre_max_length(self):
        s = CategoriaSerializer(data={"nombre": "A" * 61})
        assert not s.is_valid()
        assert "nombre" in s.errors

    def test_nombre_exactamente_60_chars(self):
        s = CategoriaSerializer(data={"nombre": "A" * 60})
        assert s.is_valid()


class TestProductoWriteSerializer:
    def test_valido(self):
        cat = CategoriaFactory()
        s = ProductoWriteSerializer(
            data={
                "nombre": "Latte",
                "precio": "12.00",
                "categoria": cat.id,
            },
        )
        assert s.is_valid(), s.errors

    def test_precio_cero_invalido(self):
        cat = CategoriaFactory()
        s = ProductoWriteSerializer(
            data={
                "nombre": "X",
                "precio": "0",
                "categoria": cat.id,
            },
        )
        assert not s.is_valid()
        assert "precio" in s.errors

    def test_precio_negativo_invalido(self):
        cat = CategoriaFactory()
        s = ProductoWriteSerializer(
            data={
                "nombre": "X",
                "precio": "-5.00",
                "categoria": cat.id,
            },
        )
        assert not s.is_valid()
        assert "precio" in s.errors

    def test_nombre_max_length(self):
        cat = CategoriaFactory()
        s = ProductoWriteSerializer(
            data={
                "nombre": "A" * 101,
                "precio": "10.00",
                "categoria": cat.id,
            },
        )
        assert not s.is_valid()
        assert "nombre" in s.errors

    def test_nombre_exactamente_100_chars(self):
        cat = CategoriaFactory()
        s = ProductoWriteSerializer(
            data={
                "nombre": "A" * 100,
                "precio": "10.00",
                "categoria": cat.id,
            },
        )
        assert s.is_valid(), s.errors

    def test_categoria_inactiva_invalida(self):
        cat = CategoriaFactory(activo=False)
        s = ProductoWriteSerializer(
            data={
                "nombre": "X",
                "precio": "10.00",
                "categoria": cat.id,
            },
        )
        assert not s.is_valid()
        assert "categoria" in s.errors

    def test_descripcion_opcional(self):
        cat = CategoriaFactory()
        s = ProductoWriteSerializer(
            data={
                "nombre": "X",
                "precio": "10.00",
                "categoria": cat.id,
            },
        )
        assert s.is_valid(), s.errors

    def test_precio_muy_grande(self):
        """Tope de negocio: S/ 9 999.99 (ver memos_cafe/utils/limites.py)."""
        cat = CategoriaFactory()
        tope = ProductoWriteSerializer(
            data={
                "nombre": "X",
                "precio": "9999.99",
                "categoria": cat.id,
            },
        )
        absurdo = ProductoWriteSerializer(
            data={
                "nombre": "X",
                "precio": "99999999.99",
                "categoria": cat.id,
            },
        )
        assert tope.is_valid(), tope.errors
        assert not absurdo.is_valid()
        assert "precio" in absurdo.errors

    def test_precio_decimal_invalido(self):
        cat = CategoriaFactory()
        s = ProductoWriteSerializer(
            data={
                "nombre": "X",
                "precio": "abc",
                "categoria": cat.id,
            },
        )
        assert not s.is_valid()
        assert "precio" in s.errors


class TestProductoEditarSerializer:
    def test_todos_campos_opcionales(self):
        s = ProductoEditarSerializer(data={})
        assert s.is_valid(), s.errors

    def test_precio_negativo_invalido(self):
        s = ProductoEditarSerializer(data={"precio": "-1.00"})
        assert not s.is_valid()
        assert "precio" in s.errors

    def test_precio_valido(self):
        s = ProductoEditarSerializer(data={"precio": "15.50"})
        assert s.is_valid(), s.errors


class TestPromocionWriteSerializer:
    def test_valido(self):
        hoy = timezone.localdate()
        s = PromocionWriteSerializer(
            data={
                "nombre": "Promo",
                "precio": "10.00",
                "fecha_inicio": str(hoy),
                "fecha_fin": str(hoy + timedelta(days=5)),
            },
        )
        assert s.is_valid(), s.errors

    def test_fecha_fin_antes_inicio_invalido(self):
        hoy = timezone.localdate()
        s = PromocionWriteSerializer(
            data={
                "nombre": "X",
                "precio": "10.00",
                "fecha_inicio": str(hoy + timedelta(days=5)),
                "fecha_fin": str(hoy + timedelta(days=1)),
            },
        )
        assert not s.is_valid()

    def test_precio_cero_invalido(self):
        hoy = timezone.localdate()
        s = PromocionWriteSerializer(
            data={
                "nombre": "X",
                "precio": "0",
                "fecha_inicio": str(hoy),
                "fecha_fin": str(hoy + timedelta(days=1)),
            },
        )
        assert not s.is_valid()
        assert "precio" in s.errors

    def test_nombre_max_length(self):
        hoy = timezone.localdate()
        s = PromocionWriteSerializer(
            data={
                "nombre": "A" * 101,
                "precio": "10.00",
                "fecha_inicio": str(hoy),
                "fecha_fin": str(hoy + timedelta(days=1)),
            },
        )
        assert not s.is_valid()
        assert "nombre" in s.errors

    def test_fecha_inicio_igual_fin_valido(self):
        hoy = timezone.localdate()
        s = PromocionWriteSerializer(
            data={
                "nombre": "X",
                "precio": "10.00",
                "fecha_inicio": str(hoy),
                "fecha_fin": str(hoy),
            },
        )
        assert s.is_valid(), s.errors
