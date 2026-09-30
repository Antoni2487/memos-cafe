import logging
from decimal import Decimal

logger = logging.getLogger("memos_cafe.ordenes")

from django.db import transaction

from memos_cafe.caja.models import Caja
from memos_cafe.mesas.models import Mesa
from memos_cafe.ordenes.models import DetalleOrden, Orden
from memos_cafe.productos.models import Producto, Promocion
from memos_cafe.realtime.notificar import notificar


class OrdenService:
    """Orquesta la creacion y gestion de ordenes."""

    @staticmethod
    def fecha_apertura_caja_actual():
        """Fecha de apertura de la sesion de caja actualmente abierta, o
        None si no hay ninguna. Encapsula el cruce hacia el dominio de
        Caja para que OrdenViewSet no importe memos_cafe.caja.models
        directamente (ver .importlinter)."""
        caja = Caja.objects.get_sesion_abierta()
        return caja.fecha_apertura if caja else None

    @staticmethod
    @transaction.atomic
    def crear_orden(
        usuario,
        tipo_orden: str,
        detalles: list[dict],
        mesa: Mesa | None = None,
        cliente_nombre: str = "",
        cliente_telefono: str = "",
        direccion_entrega: str = "",
        plataforma_delivery: str = "",
        plataforma_otra: str = "",
        mesa_ya_ocupada: bool = False,
    ) -> Orden:
        """mesa_ya_ocupada=True: la mesa ya esta 'ocupada' por un motivo
        ajeno a esta orden (pedido por QR: SesionMesaService.abrir_sesion
        ya la ocupo al abrir la sesion, antes de que exista ningun
        pedido). Salta el chequeo de 'mesa libre' y no vuelve a llamar
        mesa.ocupar(). Por defecto False: el flujo manual del mesero no
        cambia — la mesa debe estar libre y esta orden es quien la ocupa,
        igual que hoy."""
        if not Caja.objects.get_sesion_abierta():
            raise ValueError("No hay una sesion de caja abierta. Un cajero debe abrir turno antes de crear ordenes.")

        if tipo_orden == Orden.TipoOrden.MESA and not mesa:
            raise ValueError("Debe asignar una mesa para ordenes de tipo 'mesa'.")

        if tipo_orden == Orden.TipoOrden.DELIVERY and not plataforma_delivery:
            raise ValueError("Debe especificar la plataforma para ordenes delivery.")

        if mesa:
            mesa = Mesa.objects.select_for_update().get(pk=mesa.pk)
            if not mesa_ya_ocupada and mesa.estado != Mesa.Estado.LIBRE:
                raise ValueError(f"La mesa {mesa.numero} no esta libre.")

        if not detalles:
            raise ValueError("La orden debe tener al menos un item.")

        orden = Orden.objects.create(
            usuario=usuario,
            tipo_orden=tipo_orden,
            mesa=mesa,
            cliente_nombre=cliente_nombre,
            cliente_telefono=cliente_telefono,
            direccion_entrega=direccion_entrega,
            plataforma_delivery=plataforma_delivery if tipo_orden == Orden.TipoOrden.DELIVERY else "",
            plataforma_otra=plataforma_otra if tipo_orden == Orden.TipoOrden.DELIVERY else "",
        )

        if mesa and not mesa_ya_ocupada:
            mesa.ocupar()

        for item in detalles:
            DetalleOrdenService._crear_detalle(orden=orden, **item)

        orden.recalcular_total()
        orden.refresh_from_db()
        logger.info(
            "Orden #%s creada por usuario %s | tipo=%s | total=%s",
            orden.id, usuario, tipo_orden, orden.total,
        )
        OrdenService._notificar_nuevo_pedido(orden)
        return orden

    @staticmethod
    def _notificar_nuevo_pedido(orden: Orden) -> None:
        """Avisa a Cocina que hay items nuevos por preparar (orden recien
        creada, o una ronda nueva agregada a una ya abierta). Se envia al
        confirmar la transaccion y un fallo de Redis no afecta la orden
        (ver memos_cafe/realtime/notificar.py)."""
        notificar(["cocina"], {
            "type": "pedido.nuevo",
            "orden_id": orden.id,
            "mesa_numero": orden.mesa.numero if orden.mesa_id else None,
        })

    @staticmethod
    @transaction.atomic
    def anular_orden(orden: Orden) -> Orden:
        logger.warning(
            "Orden #%s ANULADA | mesa=%s | total=%s",
            orden.id, orden.mesa_id, orden.total,
        )
        orden.anular()
        return orden


class DetalleOrdenService:
    """Gestiona los items individuales dentro de una orden."""

    @staticmethod
    def _crear_detalle(
        orden: Orden,
        cantidad: int,
        nota: str = "",
        producto: Producto | None = None,
        promocion: Promocion | None = None,
        ronda: int | None = None,
    ) -> DetalleOrden:
        if not producto and not promocion:
            raise ValueError("Debe especificar al menos un producto o una promocion.")
        if cantidad <= 0:
            raise ValueError("La cantidad debe ser mayor a 0.")

        precio_unitario = Decimal("0")
        if producto:
            precio_unitario += producto.precio
        if promocion:
            precio_unitario += promocion.precio

        extra = {"ronda": ronda} if ronda is not None else {}
        return DetalleOrden.objects.create(
            orden=orden,
            producto=producto,
            promocion=promocion,
            cantidad=cantidad,
            precio_unitario=precio_unitario,
            nota=nota,
            **extra,
        )

    @staticmethod
    def siguiente_ronda(orden: Orden) -> int:
        """Numero de ronda para la proxima TANDA de items que se agrega de
        una sola vez (ej. un pedido por QR). Solo lo calculan los llamadores
        que reciben un lote completo de items juntos — el endpoint actual
        del mesero (POST .../detalles/) agrega un item por llamada y no
        tiene forma de saber si varias llamadas seguidas son una sola tanda,
        asi que esos items se quedan en la ronda 1 por defecto del modelo,
        sin cambio de comportamiento respecto a hoy."""
        from django.db.models import Max
        actual = orden.detalles.aggregate(m=Max("ronda"))["m"] or 0
        return actual + 1

    @staticmethod
    @transaction.atomic
    def agregar_detalle(
        orden: Orden,
        cantidad: int,
        nota: str = "",
        producto: Producto | None = None,
        promocion: Promocion | None = None,
        ronda: int | None = None,
    ) -> DetalleOrden:
        if not orden.esta_abierta:
            raise ValueError("No se pueden agregar items a una orden cerrada o anulada.")

        detalle = DetalleOrdenService._crear_detalle(
            orden=orden,
            cantidad=cantidad,
            nota=nota,
            producto=producto,
            promocion=promocion,
            ronda=ronda,
        )
        orden.recalcular_total()
        OrdenService._notificar_nuevo_pedido(orden)
        return detalle

    @staticmethod
    @transaction.atomic
    def eliminar_detalle(orden: Orden, detalle_id: int) -> bool:
        if not orden.esta_abierta:
            raise ValueError("No se pueden eliminar items de una orden cerrada o anulada.")

        try:
            detalle = orden.detalles.get(id=detalle_id)
        except DetalleOrden.DoesNotExist:
            raise ValueError(f"El item #{detalle_id} no existe en esta orden.")

        estaba_impreso = detalle.impreso
        if estaba_impreso:
            logger.warning(
                "Detalle #%s eliminado de Orden #%s pero ya estaba impreso",
                detalle_id, orden.id,
            )
        detalle.delete()
        orden.recalcular_total()
        return estaba_impreso

    @staticmethod
    def marcar_impreso(orden: Orden, detalle_ids: list[int]) -> None:
        if not detalle_ids:
            return
        orden.detalles.filter(id__in=detalle_ids).update(impreso=True)

    _TRANSICIONES_PREPARACION = {
        DetalleOrden.EstadoPreparacion.PENDIENTE: {DetalleOrden.EstadoPreparacion.EN_PREPARACION},
        DetalleOrden.EstadoPreparacion.EN_PREPARACION: {DetalleOrden.EstadoPreparacion.LISTO},
        DetalleOrden.EstadoPreparacion.LISTO: {DetalleOrden.EstadoPreparacion.ENTREGADO},
        DetalleOrden.EstadoPreparacion.ENTREGADO: set(),
    }

    @staticmethod
    def actualizar_estado_preparacion(detalle: DetalleOrden, nuevo_estado: str) -> DetalleOrden:
        """Avanza el estado de preparacion de un item (pendiente ->
        en_preparacion -> listo -> entregado, sin saltos ni retrocesos) y
        dispara el evento de tiempo real. El disparo vive aca, no en el
        consumer de WebSocket, para que toda la logica de negocio quede en
        la capa de servicios."""
        transiciones_validas = DetalleOrdenService._TRANSICIONES_PREPARACION.get(
            detalle.estado_preparacion, set()
        )
        if nuevo_estado not in transiciones_validas:
            raise ValueError(
                f"No se puede pasar el item #{detalle.id} de "
                f"'{detalle.estado_preparacion}' a '{nuevo_estado}'."
            )
        detalle.estado_preparacion = nuevo_estado
        detalle.save(update_fields=["estado_preparacion"])
        DetalleOrdenService._notificar_cambio_estado(detalle)
        return detalle

    @staticmethod
    def _notificar_cambio_estado(detalle: DetalleOrden) -> None:
        """Avisa el cambio a Cocina (y a los meseros cuando el item queda
        listo). Ver memos_cafe/realtime/notificar.py."""
        if detalle.producto_id:
            nombre = detalle.producto.nombre
        elif detalle.promocion_id:
            nombre = detalle.promocion.nombre
        else:
            nombre = ""

        payload = {
            "type": "detalle.actualizado",
            "detalle_id": detalle.id,
            "orden_id": detalle.orden_id,
            "estado_preparacion": detalle.estado_preparacion,
            "nombre": nombre,
            # nombre/mesa_numero van en el payload para que el mesero pueda
            # armar un mensaje ("Capuchino de Mesa 4 listo") sin tener que
            # pedirle nada mas al backend -- es la unica señal que recibe,
            # a diferencia de Cocina que ademas puede volver a consultar el
            # tablero completo.
            "mesa_numero": detalle.orden.mesa.numero if detalle.orden.mesa_id else None,
        }
        grupos = ["cocina"]
        if detalle.estado_preparacion == DetalleOrden.EstadoPreparacion.LISTO:
            grupos.append("meseros")
        notificar(grupos, payload)
