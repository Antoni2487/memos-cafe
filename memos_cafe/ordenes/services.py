import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from memos_cafe.caja.models import Caja
from memos_cafe.mesas.models import Mesa
from memos_cafe.ordenes.models import Comanda
from memos_cafe.ordenes.models import DetalleOrden
from memos_cafe.ordenes.models import Orden
from memos_cafe.productos.models import Producto
from memos_cafe.productos.models import Promocion
from memos_cafe.realtime.notificar import notificar

logger = logging.getLogger("memos_cafe.ordenes")


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
    def crear_orden(  # noqa: PLR0913 -- un parametro por campo del pedido
        usuario,
        tipo_orden: str,
        detalles: list[dict],
        mesa: Mesa | None = None,
        cliente_nombre: str = "",
        cliente_telefono: str = "",
        direccion_entrega: str = "",
        plataforma_delivery: str = "",
        plataforma_otra: str = "",
        *,
        mesa_ya_ocupada: bool = False,
        origen: str = Comanda.Origen.MESERO,
    ) -> Orden:
        """mesa_ya_ocupada=True: la mesa ya esta 'ocupada' por un motivo
        ajeno a esta orden (pedido por QR: SesionMesaService.abrir_sesion
        ya la ocupo al abrir la sesion, antes de que exista ningun
        pedido). Salta el chequeo de 'mesa libre' y no vuelve a llamar
        mesa.ocupar(). Por defecto False: el flujo manual del mesero no
        cambia — la mesa debe estar libre y esta orden es quien la ocupa,
        igual que hoy."""
        if not Caja.objects.get_sesion_abierta():
            msg = (
                "No hay una sesion de caja abierta. "
                "Un cajero debe abrir turno antes de crear ordenes."
            )
            raise ValueError(
                msg,
            )

        if tipo_orden == Orden.TipoOrden.MESA and not mesa:
            msg = "Debe asignar una mesa para ordenes de tipo 'mesa'."
            raise ValueError(msg)

        if tipo_orden == Orden.TipoOrden.DELIVERY and not plataforma_delivery:
            msg = "Debe especificar la plataforma para ordenes delivery."
            raise ValueError(msg)

        if mesa:
            mesa = Mesa.objects.select_for_update().get(pk=mesa.pk)
            # Lo que impide abrir otra orden es que la mesa ya tenga una
            # abierta. Una mesa "ocupada" sin orden (se activo su QR y el
            # cliente aun no pidio, o quedo asi por un dato viejo) si
            # admite que el mesero le tome el pedido.
            if (
                not mesa_ya_ocupada
                and Orden.objects.filter(
                    mesa=mesa,
                    estado=Orden.Estado.ABIERTA,
                ).exists()
            ):
                msg = (
                    f"La mesa {mesa.numero} ya tiene un pedido en curso: "
                    "agrega los productos como otra ronda."
                )
                raise ValueError(msg)

        if not detalles:
            msg = "La orden debe tener al menos un item."
            raise ValueError(msg)

        orden = Orden.objects.create(
            usuario=usuario,
            tipo_orden=tipo_orden,
            mesa=mesa,
            cliente_nombre=cliente_nombre,
            cliente_telefono=cliente_telefono,
            direccion_entrega=direccion_entrega,
            plataforma_delivery=plataforma_delivery
            if tipo_orden == Orden.TipoOrden.DELIVERY
            else "",
            plataforma_otra=plataforma_otra
            if tipo_orden == Orden.TipoOrden.DELIVERY
            else "",
        )

        if mesa and mesa.estado != Mesa.Estado.OCUPADA:
            mesa.ocupar()

        comanda = ComandaService.crear(orden, origen)
        for item in detalles:
            DetalleOrdenService._crear_detalle(comanda=comanda, **item)  # noqa: SLF001

        orden.recalcular_total()
        orden.refresh_from_db()
        logger.info(
            "Orden #%s creada por usuario %s | tipo=%s | total=%s",
            orden.id,
            usuario,
            tipo_orden,
            orden.total,
        )
        ComandaService.notificar_nueva(comanda)
        return orden

    @staticmethod
    @transaction.atomic
    def anular_orden(orden: Orden) -> Orden:
        logger.warning(
            "Orden #%s ANULADA | mesa=%s | total=%s",
            orden.id,
            orden.mesa_id,
            orden.total,
        )
        orden.anular()
        return orden


class DetalleOrdenService:
    """Gestiona los items individuales dentro de una orden."""

    @staticmethod
    def _crear_detalle(
        comanda: Comanda,
        cantidad: int,
        nota: str = "",
        producto: Producto | None = None,
        promocion: Promocion | None = None,
    ) -> DetalleOrden:
        if not producto and not promocion:
            msg = "Debe especificar al menos un producto o una promocion."
            raise ValueError(msg)
        if cantidad <= 0:
            msg = "La cantidad debe ser mayor a 0."
            raise ValueError(msg)

        precio_unitario = Decimal("0")
        if producto:
            precio_unitario += producto.precio
        if promocion:
            precio_unitario += promocion.precio

        return DetalleOrden.objects.create(
            orden_id=comanda.orden_id,
            comanda=comanda,
            ronda=comanda.numero,
            producto=producto,
            promocion=promocion,
            cantidad=cantidad,
            precio_unitario=precio_unitario,
            nota=nota,
        )

    @staticmethod
    @transaction.atomic
    def agregar_ronda(orden: Orden, items: list[dict], origen: str) -> Comanda:
        """Agrega una tanda de items que llega junta (una ronda pedida por
        QR) como una comanda nueva: Cocina la recibe con un solo aviso."""
        orden = Orden.objects.select_for_update().get(pk=orden.pk)
        if not orden.esta_abierta:
            msg = "No se pueden agregar items a una orden cerrada o anulada."
            raise ValueError(msg)
        if not items:
            msg = "La ronda debe tener al menos un item."
            raise ValueError(msg)
        comanda = ComandaService.crear(orden, origen)
        for item in items:
            DetalleOrdenService._crear_detalle(comanda=comanda, **item)
        orden.recalcular_total()
        ComandaService.notificar_nueva(comanda)
        return comanda

    @staticmethod
    @transaction.atomic
    def agregar_detalle(
        orden: Orden,
        cantidad: int,
        nota: str = "",
        producto: Producto | None = None,
        promocion: Promocion | None = None,
    ) -> DetalleOrden:
        """El mesero agrega un item suelto. Si la ultima comanda de la orden
        todavia no se empezo a preparar, el item se suma a ella (varios
        items seguidos del mesero son una sola tanda para Cocina); si ya
        se empezo, abre una comanda nueva."""
        orden = Orden.objects.select_for_update().get(pk=orden.pk)
        if not orden.esta_abierta:
            msg = "No se pueden agregar items a una orden cerrada o anulada."
            raise ValueError(
                msg,
            )

        ultima = orden.comandas.order_by("-numero").first()
        es_nueva = ultima is None or ultima.estado != Comanda.Estado.PENDIENTE
        comanda = (
            ComandaService.crear(orden, Comanda.Origen.MESERO) if es_nueva else ultima
        )
        detalle = DetalleOrdenService._crear_detalle(
            comanda=comanda,
            cantidad=cantidad,
            nota=nota,
            producto=producto,
            promocion=promocion,
        )
        orden.recalcular_total()
        if es_nueva:
            ComandaService.notificar_nueva(comanda)
        else:
            ComandaService.notificar_cambio(comanda)
        return detalle

    @staticmethod
    @transaction.atomic
    def eliminar_detalle(orden: Orden, detalle_id: int) -> bool:
        if not orden.esta_abierta:
            msg = "No se pueden eliminar items de una orden cerrada o anulada."
            raise ValueError(
                msg,
            )

        try:
            detalle = orden.detalles.get(id=detalle_id)
        except DetalleOrden.DoesNotExist as e:
            msg = f"El item #{detalle_id} no existe en esta orden."
            raise ValueError(msg) from e

        estaba_impreso = detalle.impreso
        if estaba_impreso:
            logger.warning(
                "Detalle #%s eliminado de Orden #%s pero ya estaba impreso",
                detalle_id,
                orden.id,
            )
        comanda = detalle.comanda
        detalle.delete()
        if comanda and not comanda.detalles.exists():
            comanda.delete()
        orden.recalcular_total()
        return estaba_impreso

    @staticmethod
    def marcar_impreso(orden: Orden, detalle_ids: list[int]) -> None:
        if not detalle_ids:
            return
        orden.detalles.filter(id__in=detalle_ids).update(impreso=True)

    _TRANSICIONES_PREPARACION = {
        DetalleOrden.EstadoPreparacion.PENDIENTE: {
            DetalleOrden.EstadoPreparacion.EN_PREPARACION,
        },
        DetalleOrden.EstadoPreparacion.EN_PREPARACION: {
            DetalleOrden.EstadoPreparacion.LISTO,
        },
        DetalleOrden.EstadoPreparacion.LISTO: {
            DetalleOrden.EstadoPreparacion.ENTREGADO,
        },
        DetalleOrden.EstadoPreparacion.ENTREGADO: set(),
    }

    @staticmethod
    def actualizar_estado_preparacion(
        detalle: DetalleOrden,
        nuevo_estado: str,
    ) -> DetalleOrden:
        """Avanza el estado de preparacion de un item (pendiente ->
        en_preparacion -> listo -> entregado, sin saltos ni retrocesos) y
        dispara el evento de tiempo real. El disparo vive aca, no en el
        consumer de WebSocket, para que toda la logica de negocio quede en
        la capa de servicios."""
        transiciones_validas = DetalleOrdenService._TRANSICIONES_PREPARACION.get(
            detalle.estado_preparacion,
            set(),
        )
        if nuevo_estado not in transiciones_validas:
            msg = (
                f"No se puede pasar el item #{detalle.id} de "
                f"'{detalle.estado_preparacion}' a '{nuevo_estado}'."
            )
            raise ValueError(
                msg,
            )
        detalle.estado_preparacion = nuevo_estado
        detalle.save(update_fields=["estado_preparacion"])
        DetalleOrdenService._notificar_cambio_estado(detalle)
        if detalle.comanda_id:
            ComandaService.sincronizar_desde_items(detalle.comanda)
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


class ComandaService:
    """Ciclo de vida de una comanda en Cocina y sus tiempos:

    pendiente -iniciar-> en_preparacion -marcar_lista-> lista -entregar-> entregada

    Registra iniciada_en, lista_en y entregada_en; con creada_en permiten
    medir la espera (recibida -> iniciada) y la preparacion (iniciada ->
    lista). Mantiene el estado_preparacion de los items en linea con el de
    la comanda."""

    ITEM = DetalleOrden.EstadoPreparacion

    @staticmethod
    def crear(orden: Orden, origen: str) -> Comanda:
        """Llamar con la orden bloqueada (select_for_update) o recien
        creada, para que dos rondas simultaneas no tomen el mismo numero."""
        ultimo = orden.comandas.aggregate(m=Max("numero"))["m"] or 0
        return Comanda.objects.create(orden=orden, numero=ultimo + 1, origen=origen)

    @staticmethod
    def _bloquear(comanda: Comanda) -> Comanda:
        return (
            Comanda.objects.select_for_update()
            .select_related("orden")
            .get(pk=comanda.pk)
        )

    @staticmethod
    @transaction.atomic
    def iniciar(comanda: Comanda) -> Comanda:
        comanda = ComandaService._bloquear(comanda)
        if comanda.estado != Comanda.Estado.PENDIENTE:
            msg = f"La comanda {comanda.numero} ya se empezo a preparar."
            raise ValueError(msg)
        ComandaService._pasar_a_preparacion(comanda)
        comanda.save(update_fields=["estado", "iniciada_en"])
        ComandaService.notificar_cambio(comanda)
        return comanda

    @staticmethod
    @transaction.atomic
    def marcar_item(detalle: DetalleOrden, *, listo: bool) -> DetalleOrden:
        """Check de un item en el tablero de Cocina. Marcar un item de una
        comanda pendiente la empieza. No cierra la comanda: eso lo hace
        marcar_lista, para que un check por error no la mande al mesero."""
        comanda = ComandaService._bloquear(detalle.comanda)
        if comanda.estado not in (
            Comanda.Estado.PENDIENTE,
            Comanda.Estado.EN_PREPARACION,
        ):
            msg = f"La comanda {comanda.numero} ya no esta en preparacion."
            raise ValueError(msg)
        if comanda.estado == Comanda.Estado.PENDIENTE:
            ComandaService._pasar_a_preparacion(comanda)
            comanda.save(update_fields=["estado", "iniciada_en"])
            detalle.refresh_from_db()
        detalle.estado_preparacion = (
            ComandaService.ITEM.LISTO if listo else ComandaService.ITEM.EN_PREPARACION
        )
        detalle.save(update_fields=["estado_preparacion"])
        ComandaService.notificar_cambio(comanda)
        return detalle

    @staticmethod
    @transaction.atomic
    def marcar_lista(comanda: Comanda) -> Comanda:
        comanda = ComandaService._bloquear(comanda)
        if comanda.estado not in (
            Comanda.Estado.PENDIENTE,
            Comanda.Estado.EN_PREPARACION,
        ):
            msg = f"La comanda {comanda.numero} ya estaba lista."
            raise ValueError(msg)
        ahora = timezone.now()
        comanda.iniciada_en = comanda.iniciada_en or ahora
        comanda.lista_en = ahora
        comanda.estado = Comanda.Estado.LISTA
        comanda.save(update_fields=["estado", "iniciada_en", "lista_en"])
        comanda.detalles.exclude(
            estado_preparacion=ComandaService.ITEM.ENTREGADO,
        ).update(
            estado_preparacion=ComandaService.ITEM.LISTO,
        )
        ComandaService.notificar_cambio(comanda)
        return comanda

    @staticmethod
    @transaction.atomic
    def entregar(comanda: Comanda) -> Comanda:
        comanda = ComandaService._bloquear(comanda)
        if comanda.estado == Comanda.Estado.ENTREGADA:
            # Dos meseros tocaron "Servido" a la vez: ya está, no es error.
            return comanda
        if comanda.estado != Comanda.Estado.LISTA:
            msg = f"La comanda {comanda.numero} todavia no esta lista."
            raise ValueError(msg)
        comanda.entregada_en = timezone.now()
        comanda.estado = Comanda.Estado.ENTREGADA
        comanda.save(update_fields=["estado", "entregada_en"])
        comanda.detalles.update(estado_preparacion=ComandaService.ITEM.ENTREGADO)
        ComandaService.notificar_cambio(comanda)
        return comanda

    @staticmethod
    def sincronizar_desde_items(comanda: Comanda) -> None:
        """Para el flujo por item (el tablero de Cocina actual avanza item
        por item): deriva el estado y los tiempos de la comanda."""
        estados = set(comanda.detalles.values_list("estado_preparacion", flat=True))
        if not estados:
            return
        item = ComandaService.ITEM
        ahora = timezone.now()
        campos = set()
        if comanda.estado == Comanda.Estado.PENDIENTE and estados != {item.PENDIENTE}:
            comanda.estado = Comanda.Estado.EN_PREPARACION
            comanda.iniciada_en = ahora
            campos |= {"estado", "iniciada_en"}
        if estados <= {item.LISTO, item.ENTREGADO} and comanda.estado in (
            Comanda.Estado.PENDIENTE,
            Comanda.Estado.EN_PREPARACION,
        ):
            comanda.estado = Comanda.Estado.LISTA
            comanda.iniciada_en = comanda.iniciada_en or ahora
            comanda.lista_en = ahora
            campos |= {"estado", "iniciada_en", "lista_en"}
        if estados == {item.ENTREGADO} and comanda.estado != Comanda.Estado.ENTREGADA:
            comanda.estado = Comanda.Estado.ENTREGADA
            comanda.entregada_en = ahora
            campos |= {"estado", "entregada_en"}
        if campos:
            comanda.save(update_fields=sorted(campos))
            ComandaService.notificar_cambio(comanda)

    @staticmethod
    def _pasar_a_preparacion(comanda: Comanda) -> None:
        comanda.estado = Comanda.Estado.EN_PREPARACION
        comanda.iniciada_en = timezone.now()
        comanda.detalles.filter(
            estado_preparacion=ComandaService.ITEM.PENDIENTE,
        ).update(
            estado_preparacion=ComandaService.ITEM.EN_PREPARACION,
        )

    # -- Avisos en tiempo real (ver memos_cafe/realtime/notificar.py) ------

    @staticmethod
    def _payload(comanda: Comanda, tipo: str) -> dict:
        orden = comanda.orden
        return {
            "type": tipo,
            "comanda_id": comanda.id,
            "orden_id": orden.id,
            "numero": comanda.numero,
            "origen": comanda.origen,
            "estado": comanda.estado,
            "mesa_numero": orden.mesa.numero if orden.mesa_id else None,
        }

    @staticmethod
    def notificar_nueva(comanda: Comanda) -> None:
        """Una comanda nueva = un solo aviso (y un solo sonido) en Cocina,
        tenga los items que tenga."""
        notificar(["cocina"], ComandaService._payload(comanda, "pedido.nuevo"))

    @staticmethod
    def notificar_cambio(comanda: Comanda) -> None:
        # Los meseros reciben todos los cambios, no solo "lista": cuando
        # uno la sirve (o Cocina la reabre) el aviso desaparece para todos.
        notificar(
            ["cocina", "meseros"],
            ComandaService._payload(comanda, "comanda.actualizada"),
        )
