from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from memos_cafe.caja.models import Pago
from memos_cafe.mesas.models import PLANO_ALTO
from memos_cafe.mesas.models import PLANO_ANCHO
from memos_cafe.mesas.models import ElementoPlano
from memos_cafe.mesas.models import Mesa
from memos_cafe.mesas.models import PedidoPorConfirmar
from memos_cafe.ordenes.models import Comanda
from memos_cafe.ordenes.models import DetalleOrden
from memos_cafe.ordenes.models import Orden
from memos_cafe.productos.models import Producto
from memos_cafe.productos.models import Promocion

# Limites del croquis (ver PLANO_ANCHO/PLANO_ALTO en mesas/models.py).
CAMPOS_PLANO = ["plano_x", "plano_y", "plano_ancho", "plano_alto", "forma", "rotacion"]
LIMITES_PLANO = {
    "plano_x": {"max_value": PLANO_ANCHO},
    "plano_y": {"max_value": PLANO_ALTO},
    "plano_ancho": {"min_value": 4, "max_value": PLANO_ANCHO},
    "plano_alto": {"min_value": 4, "max_value": PLANO_ALTO},
    "rotacion": {"max_value": 359},
}


class MesaSerializer(serializers.ModelSerializer):
    # Declarado a mano para no heredar el UniqueValidator del modelo: la
    # unicidad la valida MesaService.crear, que ademas reactiva una mesa
    # dada de baja con ese mismo numero.
    numero = serializers.IntegerField(min_value=1, max_value=32767)
    capacidad = serializers.IntegerField(min_value=1, max_value=30)
    estado_display = serializers.CharField(
        source="get_estado_display",
        read_only=True,
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
            *CAMPOS_PLANO,
        ]
        # codigo_qr solo lo ve el personal (este serializer no se usa en los
        # endpoints publicos del QR): es lo que va impreso en la mesa.
        read_only_fields = ["estado", "activo", "fecha_baja", "codigo_qr"]
        extra_kwargs = LIMITES_PLANO


# ─── Croquis del salon ─────────────────────────────────────────────────────


class ElementoPlanoSerializer(serializers.ModelSerializer):
    # id opcional: sin id, el elemento es nuevo (ver PlanoService.guardar).
    id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = ElementoPlano
        fields = ["id", "tipo", "etiqueta", *CAMPOS_PLANO]
        extra_kwargs = LIMITES_PLANO


class MesaPosicionSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField()

    class Meta:
        model = Mesa
        fields = ["id", *CAMPOS_PLANO]
        extra_kwargs = LIMITES_PLANO


class PlanoGuardarSerializer(serializers.Serializer):
    mesas = MesaPosicionSerializer(many=True)
    elementos = ElementoPlanoSerializer(many=True)

    def validate_mesas(self, mesas):
        ids = [m["id"] for m in mesas]
        if len(ids) != len(set(ids)):
            msg = "Una mesa aparece dos veces en el plano."
            raise serializers.ValidationError(msg)
        return mesas


class ResumenMesaSerializer(serializers.Serializer):
    """Lo que pasa en una mesa ocupada (PlanoService.resumen_sala)."""

    orden_id = serializers.IntegerField(allow_null=True)
    total = serializers.DecimalField(max_digits=10, decimal_places=2, allow_null=True)
    abierta_en = serializers.DateTimeField(allow_null=True)
    cliente_nombre = serializers.CharField()
    mesero = serializers.CharField()
    comandas = serializers.DictField(child=serializers.IntegerField())
    comanda_esperando_desde = serializers.DateTimeField(allow_null=True)
    pide_cuenta = serializers.BooleanField()
    metodo_cuenta = serializers.CharField(allow_null=True)
    pedido_por_confirmar_id = serializers.IntegerField(allow_null=True)


class MesaPlanoSerializer(serializers.ModelSerializer):
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    sala = serializers.SerializerMethodField()

    class Meta:
        model = Mesa
        fields = [
            "id",
            "numero",
            "capacidad",
            "estado",
            "estado_display",
            "codigo_qr",  # solo personal de sala: para mostrar el QR desde la ficha
            *CAMPOS_PLANO,
            "sala",
        ]

    def get_sala(self, obj):
        resumen = self.context.get("resumen", {}).get(obj.id)
        return ResumenMesaSerializer(resumen).data if resumen else None


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
    nota = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
        default="",
    )

    def validate(self, data):
        if not data.get("producto") and not data.get("promocion"):
            msg = "Debe especificar al menos un producto o una promoción."
            raise serializers.ValidationError(
                msg,
            )
        return data


class PedidoQRSerializer(serializers.Serializer):
    """Body de POST /api/mesas/qr/<mesa_id>/pedido/ — una ronda completa."""

    items = ItemPedidoQRSerializer(many=True)

    def validate_items(self, value):
        if not value:
            msg = "El pedido debe tener al menos un ítem."
            raise serializers.ValidationError(msg)
        return value


class SolicitarCobroQRSerializer(serializers.Serializer):
    """Body de POST /api/mesas/qr/<mesa_id>/solicitar-cobro/."""

    metodo_pago_sugerido = serializers.ChoiceField(choices=Pago.MetodoPago.choices)


class DetalleQRSerializer(serializers.ModelSerializer):
    """Lo minimo que el cliente necesita ver de cada item de su pedido."""

    nombre = serializers.SerializerMethodField()

    class Meta:
        model = DetalleOrden
        fields = [
            "id",
            "nombre",
            "cantidad",
            "precio_unitario",
            "subtotal",
            "nota",
            "ronda",
            "estado_preparacion",
        ]

    def get_nombre(self, obj):
        if obj.producto_id:
            return obj.producto.nombre
        if obj.promocion_id:
            return obj.promocion.nombre
        return ""


class ComandaQRSerializer(serializers.ModelSerializer):
    """Cada envio a Cocina (ronda) y como va: el cliente ve "en
    preparacion" o "lista" por ronda, no por cada item."""

    class Meta:
        model = Comanda
        fields = ["numero", "origen", "estado", "creada_en"]


class OrdenQRSerializer(serializers.ModelSerializer):
    """Estado del pedido en curso de la mesa — sin exponer 'usuario' ni
    otros datos internos del staff a un endpoint publico."""

    detalles = DetalleQRSerializer(many=True, read_only=True)
    comandas = ComandaQRSerializer(many=True, read_only=True)
    # Queda en el servidor: si el cliente recarga o vuelve a escanear, sigue
    # viendo que ya pidio la cuenta.
    cuenta_solicitada = serializers.SerializerMethodField()

    class Meta:
        model = Orden
        fields = ["id", "estado", "total", "detalles", "comandas", "cuenta_solicitada"]

    def get_cuenta_solicitada(self, obj):
        return any(s.atendido_en is None for s in obj.solicitudes_cobro.all())


class PedidoPorConfirmarSerializer(serializers.ModelSerializer):
    """Primer pedido por QR esperando al mesero. items trae nombre y
    precio de cada item tal como los vio el cliente."""

    mesa_numero = serializers.IntegerField(source="mesa.numero", read_only=True)
    total = serializers.SerializerMethodField()
    segundos_esperando = serializers.SerializerMethodField()

    def get_total(self, obj):
        total = sum(Decimal(item["precio"]) * item["cantidad"] for item in obj.items)
        return f"{total:.2f}"

    def get_segundos_esperando(self, obj):
        return int((timezone.now() - obj.creado_en).total_seconds())

    class Meta:
        model = PedidoPorConfirmar
        fields = [
            "id",
            "mesa",
            "mesa_numero",
            "estado",
            "items",
            "total",
            "creado_en",
            "segundos_esperando",
        ]


class SesionMesaQREstadoSerializer(serializers.Serializer):
    """Respuesta de GET /api/mesas/qr/<mesa_id>/ — indica si hay sesion
    activa y el pedido en curso, si existe."""

    sesion_activa = serializers.BooleanField()
    mesa_numero = serializers.IntegerField()
    orden = OrdenQRSerializer(allow_null=True)
    # El pedido que espera confirmacion, o el ultimo rechazado/expirado
    # (para poder explicarle al cliente que paso). None si no hay.
    pedido_por_confirmar = PedidoPorConfirmarSerializer(allow_null=True)
