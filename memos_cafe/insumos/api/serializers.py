from rest_framework import serializers

from memos_cafe.insumos.models import RegistroInsumo, TipoInsumo
from memos_cafe.utils.validators import es_alfanumerico_extendido


class TipoInsumoSerializer(serializers.ModelSerializer):
    stock_bajo = serializers.BooleanField(read_only=True)
    unidad_display = serializers.CharField(
        source="get_unidad_display", read_only=True
    )

    class Meta:
        model = TipoInsumo
        fields = [
            "id",
            "nombre",
            "unidad",
            "unidad_display",
            "stock_minimo",
            "stock_actual",
            "stock_bajo",
            "activo",
        ]
        read_only_fields = ["stock_actual"]


class TipoInsumoWriteSerializer(serializers.Serializer):
    nombre = serializers.CharField(max_length=100)
    unidad = serializers.ChoiceField(choices=TipoInsumo.Unidad.choices)
    stock_minimo = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, default=0
    )

    def validate_stock_minimo(self, value):
        if value < 0:
            raise serializers.ValidationError("El stock mínimo no puede ser negativo.")
        return value


class RegistroInsumoSerializer(serializers.ModelSerializer):
    insumo_nombre = serializers.CharField(source="insumo.nombre", read_only=True)
    insumo_unidad = serializers.CharField(source="insumo.unidad", read_only=True)
    usuario_nombre = serializers.CharField(
        source="usuario.get_full_name", read_only=True
    )

    class Meta:
        model = RegistroInsumo
        fields = [
            "id",
            "insumo",
            "insumo_nombre",
            "insumo_unidad",
            "usuario",
            "usuario_nombre",
            "cantidad",
            "costo_unitario",
            "costo_total",
            "proveedor",
            "fecha",
            "observaciones",
        ]
        read_only_fields = ["costo_total", "fecha", "usuario"]


class RegistroInsumoWriteSerializer(serializers.Serializer):
    insumo = serializers.PrimaryKeyRelatedField(
        queryset=TipoInsumo.objects.filter(activo=True)
    )
    cantidad = serializers.DecimalField(max_digits=10, decimal_places=2)
    costo_unitario = serializers.DecimalField(max_digits=10, decimal_places=2)
    proveedor = serializers.CharField(
        max_length=150, required=False, allow_blank=True, default=""
    )
    observaciones = serializers.CharField(
        max_length=255, required=False, allow_blank=True, default=""
    )

    def validate_cantidad(self, value):
        if value <= 0:
            raise serializers.ValidationError("La cantidad debe ser mayor a 0.")
        return value

    def validate_costo_unitario(self, value):
        if value <= 0:
            raise serializers.ValidationError("El costo unitario debe ser mayor a 0.")
        return value

    def validate_proveedor(self, value):
        if value and not es_alfanumerico_extendido(value):
            raise serializers.ValidationError("El proveedor contiene caracteres no permitidos.")
        return value