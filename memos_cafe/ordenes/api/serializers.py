from rest_framework import serializers

from memos_cafe.mesas.models import Mesa
from memos_cafe.ordenes.models import DetalleOrden, Orden
from memos_cafe.productos.api.serializers import ProductoSerializer, PromocionSerializer
from memos_cafe.productos.models import Producto, Promocion
from memos_cafe.utils.validators import es_alfanumerico_extendido, es_telefono_valido


class DetalleOrdenReadSerializer(serializers.ModelSerializer):
    """Lectura: producto y promoción anidados completos."""
    producto = ProductoSerializer(read_only=True)
    promocion = PromocionSerializer(read_only=True)

    class Meta:
        model = DetalleOrden
        fields = [
            "id",
            "producto",
            "promocion",
            "cantidad",
            "precio_unitario",
            "subtotal",
            "nota",
            "impreso",
        ]


class DetalleOrdenWriteSerializer(serializers.Serializer):
    """Valida un ítem al crear o agregar a una orden."""
    producto = serializers.PrimaryKeyRelatedField(
        queryset=Producto.objects.filter(disponible=True),
        required=False,
        allow_null=True,
    )
    promocion = serializers.PrimaryKeyRelatedField(
        queryset=Promocion.objects.filter(activo=True),
        required=False,
        allow_null=True,
    )
    cantidad = serializers.IntegerField(min_value=1)
    nota = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")

    def validate(self, data):
        if not data.get("producto") and not data.get("promocion"):
            raise serializers.ValidationError(
                "Debe especificar al menos un producto o una promoción."
            )
        return data


class OrdenReadSerializer(serializers.ModelSerializer):
    detalles = DetalleOrdenReadSerializer(many=True, read_only=True)
    usuario_nombre = serializers.SerializerMethodField()

    def get_usuario_nombre(self, obj):
        return obj.usuario.name or obj.usuario.email

    mesa_numero = serializers.IntegerField(source="mesa.numero", read_only=True, default=None)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    tipo_orden_display = serializers.CharField(source="get_tipo_orden_display", read_only=True)
    pagos_resumen = serializers.SerializerMethodField()

    class Meta:
        model = Orden
        fields = [
            "id", "mesa", "mesa_numero", "usuario", "usuario_nombre",
            "estado", "estado_display", "tipo_orden", "tipo_orden_display",
            "fecha_creacion", "fecha_cierre", "total",
            "cliente_nombre", "cliente_telefono", "direccion_entrega",
            "plataforma_delivery", "plataforma_otra",
            "detalles",
            "pagos_resumen",
        ]

    def get_pagos_resumen(self, obj):
        # .all() + filtro en Python, NO .filter(): un QuerySet.filter()
        # sobre una relacion ya prefetcheada (ver OrdenManager.con_detalles
        # y PagoManager.con_orden_completa) ignora la cache del prefetch y
        # dispara una query nueva por cada orden -- justo el N+1 que el
        # prefetch estaba tratando de evitar. .all() si respeta la cache
        # cuando existe, y cuando no (ej. tras un refresh_from_db()) cae
        # a una sola query sin filtrar, que Python filtra igual.
        return [
            {
                "id": p.id,
                "metodo_pago": p.metodo_pago,
                "monto": str(p.monto),
                "estado": p.estado,
            }
            for p in obj.pagos.all()
            if p.estado == "completado"
        ]


class OrdenWriteSerializer(serializers.Serializer):
    """Valida datos para crear una orden con sus ítems."""
    mesa = serializers.PrimaryKeyRelatedField(
        queryset=Mesa.objects.filter(activo=True),
        required=False,
        allow_null=True,
    )
    tipo_orden = serializers.ChoiceField(choices=Orden.TipoOrden.choices)
    detalles = DetalleOrdenWriteSerializer(many=True)

    # Campos delivery (opcionales según tipo_orden)
    cliente_nombre = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    cliente_telefono = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    direccion_entrega = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    plataforma_delivery = serializers.ChoiceField(
        choices=Orden.PlataformaDelivery.choices,
        required=False,
        allow_null=True,
    )
    plataforma_otra = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")

    def validate_cliente_nombre(self, value):
        if value and not es_alfanumerico_extendido(value):
            raise serializers.ValidationError("El nombre contiene caracteres no permitidos.")
        return value

    def validate_cliente_telefono(self, value):
        if value and not es_telefono_valido(value):
            raise serializers.ValidationError("El teléfono solo puede contener números, espacios, + y -.")
        return value

    def validate_detalles(self, value):
        if not value:
            raise serializers.ValidationError(
                "La orden debe tener al menos un ítem."
            )
        return value

    def validate(self, data):
        tipo_orden = data.get("tipo_orden")
        mesa = data.get("mesa")

        if tipo_orden == Orden.TipoOrden.MESA and not mesa:
            raise serializers.ValidationError(
                {"mesa": "Debe asignar una mesa para órdenes de tipo 'mesa'."}
            )
        if tipo_orden == Orden.TipoOrden.DELIVERY:
            if not data.get("plataforma_delivery"):
                raise serializers.ValidationError(
                    {"plataforma_delivery": "Debe especificar la plataforma para órdenes delivery."}
                )
            plataforma = data.get("plataforma_delivery")
            if plataforma == Orden.PlataformaDelivery.OTRO and not data.get("plataforma_otra"):
                raise serializers.ValidationError(
                    {"plataforma_otra": "Debe especificar el nombre de la plataforma."}
                )
        return data


class MarcarImpresoSerializer(serializers.Serializer):
    """Valida los ids de detalle a marcar como enviados a cocina/barra."""
    detalle_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
    )
