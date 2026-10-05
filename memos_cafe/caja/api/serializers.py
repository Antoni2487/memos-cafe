from rest_framework import serializers

from memos_cafe.caja.models import Caja
from memos_cafe.caja.models import Comprobante
from memos_cafe.caja.models import MovimientoCaja
from memos_cafe.caja.models import NotaCredito
from memos_cafe.caja.models import Pago
from memos_cafe.ordenes.api.serializers import OrdenReadSerializer
from memos_cafe.ordenes.models import Orden  # fix 3: import directo, sin __import__
from memos_cafe.utils.limites import NUMERO_COMPROBANTE_MAX
from memos_cafe.utils.limites import UN_CENTIMO
from memos_cafe.utils.limites import campo_monto
from memos_cafe.utils.validators import es_dni_valido
from memos_cafe.utils.validators import es_ruc_valido


class AbrirCajaSerializer(serializers.Serializer):
    """Valida los datos para abrir una sesión de caja."""

    monto_inicial = campo_monto()

    def validate_monto_inicial(self, value):
        if value < 0:
            msg = "El monto inicial no puede ser negativo."
            raise serializers.ValidationError(msg)
        return value


class CerrarCajaSerializer(serializers.Serializer):
    """Valida los datos para cerrar una sesión de caja."""

    monto_final = campo_monto()
    observaciones = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        default="",
    )

    def validate_monto_final(self, value):
        if value < 0:
            msg = "El monto final no puede ser negativo."
            raise serializers.ValidationError(msg)
        return value


class CajaReadSerializer(serializers.ModelSerializer):
    """Representación completa de una sesión de caja."""

    usuario_nombre = serializers.SerializerMethodField()

    def get_usuario_nombre(self, obj):
        return obj.usuario.name or obj.usuario.email

    total_ventas = serializers.SerializerMethodField()
    movimientos_neto = serializers.SerializerMethodField()
    esperado_en_caja = serializers.SerializerMethodField()
    diferencia = serializers.SerializerMethodField()

    class Meta:
        model = Caja
        fields = [
            "id",
            "usuario",
            "usuario_nombre",
            "estado",
            "monto_inicial",
            "monto_final",
            "total_ventas",
            "movimientos_neto",
            "esperado_en_caja",
            "diferencia",
            "fecha_apertura",
            "fecha_cierre",
            "observaciones",
        ]

    def _get_total_ventas(self, obj):
        cache_attr = "_total_ventas_cache"
        if not hasattr(obj, cache_attr):
            resultado = Pago.objects.total_por_caja(obj)
            setattr(obj, cache_attr, resultado["total"])
        return getattr(obj, cache_attr)

    def _get_movimientos_neto(self, obj):
        cache_attr = "_movimientos_neto_cache"
        if not hasattr(obj, cache_attr):
            neto = MovimientoCaja.objects.neto_por_caja(obj)
            setattr(obj, cache_attr, neto)
        return getattr(obj, cache_attr)

    def get_total_ventas(self, obj):
        return self._get_total_ventas(obj)

    def get_movimientos_neto(self, obj):
        return self._get_movimientos_neto(obj)

    def get_esperado_en_caja(self, obj):
        ventas = self._get_total_ventas(obj)
        neto_mov = self._get_movimientos_neto(obj)
        return obj.monto_inicial + ventas + neto_mov

    def get_diferencia(self, obj):
        if obj.monto_final is None:
            return None
        esperado = self.get_esperado_en_caja(obj)
        return obj.monto_final - esperado


class MovimientoCajaSerializer(serializers.Serializer):
    """Valida datos para registrar un movimiento de caja."""

    tipo = serializers.ChoiceField(choices=MovimientoCaja.Tipo.choices)
    monto = campo_monto(minimo=UN_CENTIMO)
    motivo = serializers.CharField(max_length=200)

    def validate_monto(self, value):
        if value <= 0:
            msg = "El monto debe ser mayor a 0."
            raise serializers.ValidationError(msg)
        return value


class MovimientoCajaReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = MovimientoCaja
        fields = ["id", "tipo", "monto", "motivo", "fecha"]


class PagoWriteSerializer(serializers.Serializer):
    orden = serializers.PrimaryKeyRelatedField(
        queryset=Orden.objects.filter(estado="abierta"),
    )
    metodo_pago = serializers.ChoiceField(choices=Pago.MetodoPago.choices)
    monto = campo_monto(minimo=UN_CENTIMO)
    monto_recibido = campo_monto(required=False, allow_null=True)
    numero_operacion = serializers.CharField(
        max_length=50,
        required=False,
        allow_blank=True,
        default="",
    )

    def validate_monto(self, value):
        if value <= 0:
            msg = "El monto debe ser mayor a 0."
            raise serializers.ValidationError(msg)
        return value


class NotaCreditoWriteSerializer(serializers.Serializer):
    """Valida el motivo obligatorio al anular un pago."""

    motivo = serializers.ChoiceField(choices=NotaCredito.Motivo.choices)
    detalle = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default="",
    )

    def validate(self, data):
        if (
            data["motivo"] == NotaCredito.Motivo.OTRO
            and not data.get("detalle", "").strip()
        ):
            raise serializers.ValidationError(
                {"detalle": "Para el motivo 'Otro' debes especificar un detalle."},
            )
        return data


class NotaCreditoReadSerializer(serializers.ModelSerializer):
    motivo_display = serializers.CharField(source="get_motivo_display", read_only=True)
    usuario_nombre = serializers.CharField(
        source="usuario.get_full_name",
        read_only=True,
    )

    class Meta:
        model = NotaCredito
        fields = [
            "id",
            "motivo",
            "motivo_display",
            "detalle",
            "monto",
            "usuario_nombre",
            "fecha",
        ]


class PagoReadSerializer(serializers.ModelSerializer):
    orden = OrdenReadSerializer(read_only=True)
    metodo_pago_display = serializers.CharField(
        source="get_metodo_pago_display",
        read_only=True,
    )
    comprobante = serializers.SerializerMethodField()
    nota_credito = serializers.SerializerMethodField()

    class Meta:
        model = Pago
        fields = [
            "id",
            "orden",
            "caja",
            "metodo_pago",
            "metodo_pago_display",
            "monto",
            "monto_recibido",
            "vuelto",
            "numero_operacion",
            "estado",
            "fecha",
            "comprobante",
            "nota_credito",
        ]

    def get_comprobante(self, obj):
        if hasattr(obj, "comprobante"):
            # Definido más abajo en este mismo módulo: ya existe al llamarse.
            return ComprobanteReadSerializer(obj.comprobante).data
        return None

    def get_nota_credito(self, obj):
        if hasattr(obj, "nota_credito"):
            return NotaCreditoReadSerializer(obj.nota_credito).data
        return None


class ComprobanteWriteSerializer(serializers.Serializer):
    """Valida datos para emitir un comprobante."""

    pago = serializers.PrimaryKeyRelatedField(
        queryset=Pago.objects.filter(estado="completado"),
    )
    tipo = serializers.ChoiceField(choices=Comprobante.TipoComprobante.choices)
    serie = serializers.CharField(max_length=10)
    numero = serializers.IntegerField(min_value=1, max_value=NUMERO_COMPROBANTE_MAX)
    cliente_nombre = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
        default="",
    )
    cliente_ruc_dni = serializers.CharField(
        max_length=11,
        required=False,
        allow_blank=True,
        default="",
    )
    cliente_direccion = serializers.CharField(
        max_length=255,
        required=False,
        allow_blank=True,
        default="",
    )

    def validate(self, data):
        tipo = data.get("tipo")
        ruc_dni = data.get("cliente_ruc_dni", "").strip()

        if tipo == Comprobante.TipoComprobante.FACTURA:
            if not data.get("cliente_nombre", "").strip():
                raise serializers.ValidationError(
                    {
                        "cliente_nombre": (
                            "Para emitir una factura se requiere el nombre del cliente."
                        ),
                    },
                )
            if not es_ruc_valido(ruc_dni):
                raise serializers.ValidationError(
                    {
                        "cliente_ruc_dni": (
                            "El RUC debe tener exactamente 11 dígitos numéricos."
                        ),
                    },
                )
        elif tipo == Comprobante.TipoComprobante.BOLETA:
            if ruc_dni and not es_dni_valido(ruc_dni):
                raise serializers.ValidationError(
                    {
                        "cliente_ruc_dni": (
                            "El DNI debe tener exactamente 8 dígitos numéricos."
                        ),
                    },
                )
        return data


class ComprobanteReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comprobante
        fields = [
            "id",
            "pago",
            "tipo",
            "serie",
            "numero",
            "cliente_nombre",
            "cliente_ruc_dni",
            "cliente_direccion",
            "fecha_emision",
        ]
