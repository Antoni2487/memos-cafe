from rest_framework import serializers

from memos_cafe.productos.models import Categoria
from memos_cafe.productos.models import Producto
from memos_cafe.productos.models import Promocion
from memos_cafe.utils.limites import campo_precio

MAX_IMAGEN_MB = 5
MAX_IMAGEN_BYTES = MAX_IMAGEN_MB * 1024 * 1024


def validar_tamano_imagen(imagen):
    if imagen and imagen.size > MAX_IMAGEN_BYTES:
        msg = f"La imagen no debe superar los {MAX_IMAGEN_MB}MB."
        raise serializers.ValidationError(msg)


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ["id", "nombre", "activo"]


class ProductoSerializer(serializers.ModelSerializer):
    """Lectura — incluye nombre de categoría."""

    categoria_nombre = serializers.CharField(
        source="categoria.nombre",
        read_only=True,
    )

    class Meta:
        model = Producto
        fields = [
            "id",
            "nombre",
            "descripcion",
            "precio",
            "categoria",
            "categoria_nombre",
            "disponible",
            "imagen",
        ]


class ProductoWriteSerializer(serializers.Serializer):
    """Escritura — valida datos para crear un producto."""

    nombre = serializers.CharField(max_length=100)
    descripcion = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        default="",
    )
    precio = campo_precio()
    categoria = serializers.PrimaryKeyRelatedField(
        queryset=Categoria.objects.filter(activo=True),
    )
    disponible = serializers.BooleanField(default=True)
    imagen = serializers.ImageField(required=False, allow_null=True)

    def validate_precio(self, value):
        if value <= 0:
            msg = "El precio debe ser mayor a 0."
            raise serializers.ValidationError(msg)
        return value

    def validate_imagen(self, value):
        validar_tamano_imagen(value)
        return value


class ProductoEditarSerializer(serializers.Serializer):
    """Escritura parcial — para editar un producto existente."""

    nombre = serializers.CharField(max_length=100, required=False)
    descripcion = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
    )
    precio = campo_precio(required=False)
    categoria = serializers.PrimaryKeyRelatedField(
        queryset=Categoria.objects.filter(activo=True),
        required=False,
    )
    imagen = serializers.ImageField(required=False, allow_null=True)

    def validate_precio(self, value):
        if value is not None and value <= 0:
            msg = "El precio debe ser mayor a 0."
            raise serializers.ValidationError(msg)
        return value

    def validate_imagen(self, value):
        validar_tamano_imagen(value)
        return value


class PromocionSerializer(serializers.ModelSerializer):
    vigente = serializers.SerializerMethodField()

    class Meta:
        model = Promocion
        fields = [
            "id",
            "nombre",
            "descripcion",
            "imagen",
            "precio",
            "activo",
            "fecha_inicio",
            "fecha_fin",
            "vigente",
        ]

    def get_vigente(self, obj):
        return obj.esta_vigente()


class PromocionWriteSerializer(serializers.Serializer):
    """Escritura — valida datos para crear una promoción."""

    nombre = serializers.CharField(max_length=100)
    descripcion = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        default="",
    )
    imagen = serializers.ImageField(required=False, allow_null=True)
    precio = campo_precio()
    fecha_inicio = serializers.DateField()
    fecha_fin = serializers.DateField()

    def validate_precio(self, value):
        if value <= 0:
            msg = "El precio debe ser mayor a 0."
            raise serializers.ValidationError(msg)
        return value

    def validate_imagen(self, value):
        validar_tamano_imagen(value)
        return value

    def validate(self, data):
        if data.get("fecha_fin") and data.get("fecha_inicio"):
            if data["fecha_fin"] < data["fecha_inicio"]:
                raise serializers.ValidationError(
                    {
                        "fecha_fin": (
                            "La fecha de fin no puede ser anterior a la de inicio."
                        ),
                    },
                )
        return data


class PromocionEditarSerializer(serializers.Serializer):
    """Escritura parcial — para editar una promoción existente."""

    nombre = serializers.CharField(max_length=100, required=False)
    descripcion = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
    )
    imagen = serializers.ImageField(required=False, allow_null=True)
    precio = campo_precio(required=False)
    fecha_inicio = serializers.DateField(required=False)
    fecha_fin = serializers.DateField(required=False)

    def validate_precio(self, value):
        if value is not None and value <= 0:
            msg = "El precio debe ser mayor a 0."
            raise serializers.ValidationError(msg)
        return value

    def validate_imagen(self, value):
        validar_tamano_imagen(value)
        return value
