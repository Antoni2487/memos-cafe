import logging
from decimal import Decimal

from django.db import IntegrityError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from memos_cafe.caja.models import Caja
from memos_cafe.caja.models import Comprobante
from memos_cafe.caja.models import MovimientoCaja
from memos_cafe.caja.models import NotaCredito
from memos_cafe.caja.models import Pago
from memos_cafe.caja.models import SolicitudCobro
from memos_cafe.ordenes.models import Orden
from memos_cafe.utils.validators import es_dni_valido
from memos_cafe.utils.validators import es_ruc_valido

logger = logging.getLogger("memos_cafe.caja")

UMBRAL_DIFERENCIA_SIN_OBSERVACION = Decimal("5.00")


class CajaService:
    @staticmethod
    @transaction.atomic
    def abrir_sesion(usuario, monto_inicial: Decimal) -> Caja:
        if Caja.objects.get_sesion_abierta():
            msg = (
                "Ya existe una sesion de caja abierta. "
                "Cierrela antes de abrir una nueva."
            )
            raise ValueError(msg)
        try:
            caja = Caja.objects.create(usuario=usuario, monto_inicial=monto_inicial)
        except IntegrityError as e:
            msg = (
                "Ya existe una sesion de caja abierta. "
                "Cierrela antes de abrir una nueva."
            )
            raise ValueError(msg) from e
        logger.info(
            "Caja #%s ABIERTA | usuario=%s | monto_inicial=%s",
            caja.id,
            usuario,
            monto_inicial,
        )
        return caja

    @staticmethod
    @transaction.atomic
    def cerrar_sesion(monto_final: Decimal, observaciones: str = "") -> Caja:
        caja = Caja.objects.get_sesion_abierta_para_cierre()

        ordenes_pendientes = Orden.objects.filter(estado=Orden.Estado.ABIERTA).count()
        if ordenes_pendientes > 0:
            msg = (
                f"Hay {ordenes_pendientes} orden(es) sin cobrar. "
                f"Cobralas o anulalas antes de cerrar la caja."
            )
            raise ValueError(msg)

        total_ventas = Pago.objects.filter(
            caja=caja,
            estado=Pago.Estado.COMPLETADO,
        ).aggregate(total=Sum("monto"))["total"] or Decimal("0")
        movimientos_neto = MovimientoCaja.objects.neto_por_caja(caja)
        esperado = caja.monto_inicial + total_ventas + movimientos_neto
        diferencia = Decimal(monto_final) - esperado

        if (
            abs(diferencia) > UMBRAL_DIFERENCIA_SIN_OBSERVACION
            and not observaciones.strip()
        ):
            msg = (
                f"La diferencia de caja (S/.{diferencia:.2f}) supera el margen "
                f"permitido (S/.{UMBRAL_DIFERENCIA_SIN_OBSERVACION}). "
                "Debes indicar una observacion."
            )
            raise ValueError(msg)

        caja.cerrar(monto_final=monto_final, observaciones=observaciones)
        logger.info(
            "Caja #%s CERRADA | monto_final=%s | esperado=%s | diferencia=%s",
            caja.id,
            monto_final,
            esperado,
            diferencia,
        )
        return caja

    @staticmethod
    def registrar_movimiento(tipo: str, monto: Decimal, motivo: str) -> MovimientoCaja:
        if monto <= 0:
            msg = "El monto debe ser mayor a 0."
            raise ValueError(msg)
        caja = Caja.objects.get_sesion_abierta_o_error()
        return MovimientoCaja.objects.create(
            caja=caja,
            tipo=tipo,
            monto=monto,
            motivo=motivo,
        )


class PagoService:
    @staticmethod
    @transaction.atomic
    def procesar_pago(
        orden: Orden,
        metodo_pago: str,
        monto: Decimal,
        monto_recibido: Decimal | None = None,
        numero_operacion: str = "",
    ) -> Pago:

        orden = Orden.objects.select_for_update().get(pk=orden.pk)

        if orden.estado != Orden.Estado.ABIERTA:
            msg = "Solo se pueden cobrar ordenes abiertas."
            raise ValueError(msg)

        if monto <= 0:
            msg = "El monto del pago debe ser mayor a 0."
            raise ValueError(msg)

        pagado_previo = Pago.objects.filter(
            orden=orden,
            estado=Pago.Estado.COMPLETADO,
        ).aggregate(total=Sum("monto"))["total"] or Decimal("0")
        pendiente = orden.total - pagado_previo

        if pendiente <= 0:
            msg = "Esta orden ya esta completamente pagada."
            raise ValueError(msg)

        if monto > pendiente:
            msg = (
                f"El monto ingresado (S/.{monto}) supera el pendiente "
                f"(S/.{pendiente:.2f})."
            )
            raise ValueError(msg)

        vuelto = Decimal("0")
        es_ultimo_pago = monto == pendiente

        if metodo_pago == Pago.MetodoPago.EFECTIVO and es_ultimo_pago:
            recibido = monto_recibido if monto_recibido is not None else monto
            if recibido < monto:
                msg = f"Monto recibido insuficiente. Se deben cubrir S/.{monto:.2f}."
                raise ValueError(msg)
            vuelto = recibido - monto
        elif metodo_pago == Pago.MetodoPago.EFECTIVO and monto_recibido is not None:
            if monto_recibido < monto:
                msg = f"Monto recibido insuficiente. Se deben cubrir S/.{monto:.2f}."
                raise ValueError(msg)

        caja = Caja.objects.get_sesion_abierta_o_error()

        pago = Pago.objects.create(
            orden=orden,
            caja=caja,
            metodo_pago=metodo_pago,
            monto=monto,
            monto_recibido=monto_recibido
            if metodo_pago == Pago.MetodoPago.EFECTIVO
            else None,
            vuelto=vuelto,
            numero_operacion=numero_operacion
            if metodo_pago == Pago.MetodoPago.TARJETA
            else "",
        )

        total_pagado = pagado_previo + monto
        if total_pagado >= orden.total:
            orden.cerrar()
            # Ya se cobró: el "pidió la cuenta" del cliente queda atendido.
            SolicitudCobro.objects.filter(orden=orden, atendido_en__isnull=True).update(
                atendido_en=timezone.now(),
            )

        logger.info(
            "Pago #%s PROCESADO | orden=#%s | metodo=%s | monto=%s | caja=#%s",
            pago.id,
            orden.id,
            metodo_pago,
            monto,
            caja.id,
        )
        return pago

    @staticmethod
    @transaction.atomic
    def anular_pago(pago: Pago, motivo: str, usuario, detalle: str = "") -> Pago:
        """Anula un pago y genera una nota de credito interna con el motivo.
        La orden asociada NUNCA se reabre automaticamente: si el cliente
        necesita pagar de nuevo, se crea una orden nueva. Esto evita que
        ordenes ya cerradas reaparezcan mezcladas en 'por cobrar' sin que
        nadie lo decida explicitamente."""
        if pago.estado == Pago.Estado.ANULADO:
            msg = "Este pago ya esta anulado."
            raise ValueError(msg)

        orden = Orden.objects.select_for_update().get(pk=pago.orden_id)
        if orden.estado == Orden.Estado.ANULADA:
            msg = "La orden asociada a este pago ya esta anulada."
            raise ValueError(msg)

        pago.anular()

        NotaCredito.objects.create(
            pago=pago,
            motivo=motivo,
            detalle=detalle,
            monto=pago.monto,
            usuario=usuario,
        )

        MovimientoCaja.objects.create(
            caja=pago.caja,
            tipo=MovimientoCaja.Tipo.SALIDA,
            monto=pago.monto,
            motivo=f"Nota de credito - Pago #{pago.id} - Orden #{orden.id} - {motivo}",
        )

        logger.warning(
            "Pago #%s ANULADO | orden=#%s | monto=%s | usuario=%s | motivo=%s",
            pago.id,
            orden.id,
            pago.monto,
            usuario,
            motivo,
        )
        return pago


class ComprobanteService:
    @staticmethod
    def emitir(  # noqa: PLR0913
        pago: Pago,
        tipo: str,
        serie: str,
        numero: int,
        cliente_nombre: str = "",
        cliente_ruc_dni: str = "",
        cliente_direccion: str = "",
    ) -> Comprobante:

        if hasattr(pago, "comprobante"):
            msg = "Este pago ya tiene un comprobante emitido."
            raise ValueError(msg)

        if tipo == Comprobante.TipoComprobante.FACTURA:
            if not cliente_nombre or not cliente_ruc_dni:
                msg = "Para emitir una factura se requiere nombre y RUC del cliente."
                raise ValueError(msg)
            if not es_ruc_valido(cliente_ruc_dni):
                msg = "El RUC debe tener exactamente 11 dígitos numéricos."
                raise ValueError(msg)
        elif tipo == Comprobante.TipoComprobante.BOLETA:
            if cliente_ruc_dni and not es_dni_valido(cliente_ruc_dni):
                msg = "El DNI debe tener exactamente 8 dígitos numéricos."
                raise ValueError(msg)

        comprobante = Comprobante.objects.create(
            pago=pago,
            tipo=tipo,
            serie=serie,
            numero=numero,
            cliente_nombre=cliente_nombre,
            cliente_ruc_dni=cliente_ruc_dni,
            cliente_direccion=cliente_direccion,
        )
        logger.info(
            "Comprobante emitido | tipo=%s | serie=%s-%s | pago=#%s",
            tipo,
            serie,
            numero,
            pago.id,
        )
        return comprobante
