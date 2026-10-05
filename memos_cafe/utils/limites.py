"""Límites de negocio de los campos numéricos.

El tamaño de las columnas (max_digits, SmallIntegerField) solo evita que la
base de datos reviente; estos son los valores que tienen sentido en el café.
El frontend usa los mismos (RANGOS en frontend/src/utils/validators.ts) para
no dejar escribirlos, pero la validación real es esta.
"""

from decimal import Decimal

from rest_framework import serializers

MESA_NUMERO_MAX = 999
CANTIDAD_ITEM_MAX = 99  # unidades de un mismo producto en una ronda
PRECIO_MIN = Decimal("0.10")
PRECIO_MAX = Decimal("9999.99")
MONTO_MAX = Decimal("99999.99")  # dinero en caja, pagos, costos
CANTIDAD_INSUMO_MAX = Decimal("999999.99")
NUMERO_COMPROBANTE_MAX = 99_999_999  # 8 dígitos, como en la serie-número

# Cuántas cosas distintas puede traer una sola petición (evita que alguien
# mande miles de líneas de golpe).
LINEAS_POR_PEDIDO_MAX = 50
MESAS_EN_PLANO_MAX = 200
ELEMENTOS_EN_PLANO_MAX = 200

UN_CENTIMO = Decimal("0.01")
CERO = Decimal("0")


def campo_cantidad_item(**kwargs) -> serializers.IntegerField:
    return serializers.IntegerField(min_value=1, max_value=CANTIDAD_ITEM_MAX, **kwargs)


def campo_precio(**kwargs) -> serializers.DecimalField:
    return serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=PRECIO_MIN,
        max_value=PRECIO_MAX,
        **kwargs,
    )


def campo_monto(minimo: Decimal = CERO, **kwargs) -> serializers.DecimalField:
    return serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=minimo,
        max_value=MONTO_MAX,
        **kwargs,
    )


def campo_cantidad_insumo(minimo: Decimal = CERO, **kwargs) -> serializers.DecimalField:
    return serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=minimo,
        max_value=CANTIDAD_INSUMO_MAX,
        **kwargs,
    )
