from rest_framework import serializers

from memos_cafe.caja.models import Pago
from memos_cafe.mesas.models import Mesa
from memos_cafe.ordenes.models import DetalleOrden, Orden
from memos_cafe.productos.models import Producto, Promocion


class MesaSerializer(serializers.ModelSerializer):
    estado_display = serializers.CharField(
        source="get_estado_display", read_only=True
    )

    class Meta:
        model = Mesa
        fields = [
            "id",
            "numero",
            "capacidad",
            "estado",
            "estado_display",
            "activo",
            "fecha_baja",
            "codigo_qr",
        ]
        # codigo_qr solo lo ve el personal (este serializer no se usa en los
        # endpoints publicos del QR): es lo que va impreso en la mesa.
        read_only_fields = ["estado", "activo", "fecha_baja", "codigo_qr"]


class MesaEstadoSerializer(serializers.Serializer):
    """Valida el cambio de estado de una mesa."""
    estado = serializers.ChoiceField(choices=Mesa.Estado.choices)


# ─── Pedido por QR (endpoints publicos, sin login) ─────────────────────────
# Serializers propios en vez de reusar ordenes.api.serializers: evita
# acoplar mesas.api a otra app de negocio y, de paso, expone solo lo que
# el cliente final necesita ver (nada de "usuario", "pagos_resumen", etc.
# que si trae ordenes.api.serializers.OrdenReadSerializer).

class ItemPedidoQRSerializer(serializers.Serializer):
    """Un item del carrito que el cliente manda por QR. Misma validacion
    que ordenes.api.serializers.DetalleOrdenWriteSerializer — duplicada a
    proposito para no acoplar esta app a ordenes.api (ver .importlinter)."""
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


class PedidoQRSerializer(serializers.Serializer):
    """Body de POST /api/mesas/qr/<mesa_id>/pedido/ — una ronda completa."""
    items = ItemPedidoQRSerializer(many=True)

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("El pedido debe tener al menos un ítem.")
        return value


class SolicitarCobroQRSerializer(serializers.Serializer):
    """Body de POST /api/mesas/qr/<mesa_id>/solicitar-cobro/."""
    metodo_pago_sugerido = serializers.ChoiceField(choices=Pago.MetodoPago.choices)


class DetalleQRSerializer(serializers.ModelSerializer):
    """Lo minimo que el cliente necesita ver de cada item de su pedido."""
    nombre = serializers.SerializerMethodField()

    class Meta:
        model = DetalleOrden
        fields = ["id", "nombre", "cantidad", "precio_unitario", "subtotal", "nota", "ronda", "estado_preparacion"]

    def get_nombre(self, obj):
        if obj.producto_id:
            return obj.producto.nombre
        if obj.promocion_id:
            return obj.promocion.nombre
        return ""


class OrdenQRSerializer(serializers.ModelSerializer):
    """Estado del pedido en curso de la mesa — sin exponer 'usuario' ni
    otros datos internos del staff a un endpoint publico."""
    detalles = DetalleQRSerializer(many=True, read_only=True)

    class Meta:
        model = Orden
        fields = ["id", "estado", "total", "detalles"]


class SesionMesaQREstadoSerializer(serializers.Serializer):
    """Respuesta de GET /api/mesas/qr/<mesa_id>/ — indica si hay sesion
    activa y el pedido en curso, si existe."""
    sesion_activa = serializers.BooleanField()
    mesa_numero = serializers.IntegerField()
    orden = OrdenQRSerializer(allow_null=True)
