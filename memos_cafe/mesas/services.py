from django.db import transaction

from memos_cafe.mesas.models import Mesa, SesionMesaQR, generar_codigo_qr

# Cruce a otras apps de negocio (ordenes/caja) permitido en la capa de
# servicios — igual patron que ordenes/services.py importando Mesa/Caja.
# Las vistas de mesas/api/ nunca importan estos modulos directo (ver
# .importlinter, contrato "vistas-no-cruzan-apps-de-negocio"): siempre
# pasan por SesionMesaService, que es quien conoce el cruce.
from memos_cafe.caja.models import SolicitudCobro
from memos_cafe.ordenes.models import Orden
from memos_cafe.ordenes.services import DetalleOrdenService, OrdenService
from memos_cafe.realtime.notificar import notificar


class MesaService:
    @staticmethod
    def crear(numero: int, capacidad: int) -> Mesa:
        if Mesa.objects.filter(numero=numero).exists():
            raise ValueError(f"Ya existe una mesa con el número {numero}.")
        if capacidad <= 0:
            raise ValueError("La capacidad debe ser mayor a 0.")
        return Mesa.objects.create(numero=numero, capacidad=capacidad)

    @staticmethod
    def actualizar(mesa: Mesa, numero: int = None, capacidad: int = None) -> Mesa:
        if numero and numero != mesa.numero:
            if Mesa.objects.filter(numero=numero).exists():
                raise ValueError(f"Ya existe una mesa con el número {numero}.")
            mesa.numero = numero
        if capacidad is not None:
            if capacidad <= 0:
                raise ValueError("La capacidad debe ser mayor a 0.")
            mesa.capacidad = capacidad
        mesa.save(update_fields=["numero", "capacidad"])
        return mesa

    @staticmethod
    def dar_de_baja(mesa: Mesa) -> Mesa:
        if mesa.estado == Mesa.Estado.OCUPADA:
            raise ValueError(
                f"No se puede dar de baja la mesa {mesa.numero} porque está ocupada."
            )
        mesa.dar_de_baja()
        return mesa

    @staticmethod
    def cambiar_estado(mesa: Mesa, nuevo_estado: str) -> Mesa:
        """Cambio manual de estado (endpoint PATCH /mesas/{id}/estado/).

        'ocupada' NUNCA es un destino valido aqui: una mesa se ocupa
        unicamente como consecuencia de crear una orden (Mesa.ocupar()),
        nunca por accion manual del mesero/admin.
        'libre' tampoco es alcanzable manualmente desde 'ocupada': se
        libera automaticamente al cobrar o anular la orden asociada
        (Mesa.liberar()). Desde 'ocupada' no hay transicion manual posible.

        Las unicas transiciones manuales permitidas son reservar y
        cancelar una reserva.
        """
        transiciones_validas = {
            Mesa.Estado.LIBRE: [Mesa.Estado.RESERVADA],
            Mesa.Estado.RESERVADA: [Mesa.Estado.LIBRE],
            Mesa.Estado.OCUPADA: [],
        }
        if nuevo_estado not in transiciones_validas.get(mesa.estado, []):
            raise ValueError(
                f"No se puede cambiar el estado de '{mesa.estado}' a '{nuevo_estado}' manualmente."
            )
        mesa.estado = nuevo_estado
        mesa.save(update_fields=["estado"])
        return mesa


    @staticmethod
    def regenerar_codigo_qr(mesa: Mesa) -> Mesa:
        """Invalida el QR impreso de la mesa (por ejemplo, si se filtro una
        foto) y le asigna uno nuevo. El QR viejo deja de funcionar al
        instante: hay que imprimir y pegar el nuevo."""
        mesa.codigo_qr = generar_codigo_qr()
        mesa.save(update_fields=["codigo_qr"])
        return mesa


class SesionMesaService:
    """Abre/cierra la sesion de pedido por QR de una mesa. La atribucion de
    la venta al mesero y la validez del QR fisico (que nunca cambia)
    dependen de que exista como maximo una sesion activa por mesa."""

    @staticmethod
    @transaction.atomic
    def abrir_sesion(mesa: Mesa, mesero) -> SesionMesaQR:
        mesa = Mesa.objects.select_for_update().get(pk=mesa.pk)
        if mesa.estado != Mesa.Estado.LIBRE:
            raise ValueError(f"La mesa {mesa.numero} no está libre para abrir un pedido por QR.")
        sesion = SesionMesaQR.objects.create(mesa=mesa, mesero=mesero)
        mesa.ocupar()
        return sesion

    @staticmethod
    def sesion_activa(mesa: Mesa) -> SesionMesaQR | None:
        return SesionMesaQR.objects.filter(mesa=mesa, cerrada_en__isnull=True).first()

    @staticmethod
    @transaction.atomic
    def cancelar_sesion(mesa: Mesa) -> None:
        """Cierra una sesion de pedido por QR que se abrio por error y
        nunca genero ningun pedido (el mesero se equivoco de mesa, o el
        cliente nunca llego a pedir). Libera la mesa.

        Si ya hay una Orden abierta para la mesa, se rechaza: esa orden
        hay que anularla o cerrarla (lo que ya libera la mesa y cierra la
        sesion solo, via Mesa.liberar()) -- esto no es un atajo para
        descartar pedidos reales."""
        mesa = Mesa.objects.select_for_update().get(pk=mesa.pk)
        sesion = SesionMesaQR.objects.filter(mesa=mesa, cerrada_en__isnull=True).first()
        if not sesion:
            raise ValueError(f"La mesa {mesa.numero} no tiene una sesión de pedido por QR activa.")
        if Orden.objects.filter(mesa=mesa, estado=Orden.Estado.ABIERTA).exists():
            raise ValueError(
                f"La mesa {mesa.numero} ya tiene un pedido en curso — anúlalo o ciérralo, "
                "eso libera la mesa automáticamente."
            )
        mesa.liberar()

    @staticmethod
    @transaction.atomic
    def registrar_pedido(mesa: Mesa, items: list[dict]) -> Orden:
        """Crea la Orden de la mesa (primer pedido de la sesion) o agrega
        una ronda nueva a la que ya esta abierta — ambos casos reusan
        OrdenService/DetalleOrdenService de ordenes/services.py tal cual,
        sin tocar su firma. El mesero que abrio la sesion queda como
        usuario de la orden, asi que Orden.usuario no necesita ser
        nullable para pedidos que se originan por QR."""
        mesa = Mesa.objects.select_for_update().get(pk=mesa.pk)
        sesion = SesionMesaQR.objects.filter(mesa=mesa, cerrada_en__isnull=True).first()
        if not sesion:
            raise ValueError(
                f"No hay un pedido abierto para la mesa {mesa.numero}. "
                "Pedile a tu mesero que la abra."
            )

        orden = Orden.objects.filter(
            mesa=mesa, estado=Orden.Estado.ABIERTA
        ).order_by("-fecha_creacion").first()

        if orden is None:
            return OrdenService.crear_orden(
                usuario=sesion.mesero,
                tipo_orden=Orden.TipoOrden.MESA,
                mesa=mesa,
                detalles=items,
                mesa_ya_ocupada=True,  # abrir_sesion() ya la ocupo al abrir
            )

        ronda = DetalleOrdenService.siguiente_ronda(orden)
        for item in items:
            DetalleOrdenService.agregar_detalle(orden=orden, ronda=ronda, **item)
        orden.refresh_from_db()
        return orden

    @staticmethod
    def solicitar_cobro(mesa: Mesa, metodo_pago_sugerido: str) -> SolicitudCobro:
        orden = Orden.objects.filter(
            mesa=mesa, estado=Orden.Estado.ABIERTA
        ).order_by("-fecha_creacion").first()
        if orden is None:
            raise ValueError(f"No hay una orden abierta para la mesa {mesa.numero}.")
        solicitud = SolicitudCobro.objects.create(
            orden=orden, metodo_pago_sugerido=metodo_pago_sugerido
        )
        SesionMesaService._notificar_solicitud_cobro(mesa, solicitud)
        return solicitud

    @staticmethod
    def _notificar_solicitud_cobro(mesa: Mesa, solicitud: SolicitudCobro) -> None:
        """Avisa en vivo a mesero y cajero — el admin ya se entera de esto
        via el polling de /api/alertas/ (AlertasView), asi que no hace
        falta duplicarlo aca. Ver memos_cafe/realtime/notificar.py."""
        notificar(["meseros"], {
            "type": "solicitud_cobro.nueva",
            "mesa_numero": mesa.numero,
            "metodo_pago_sugerido": solicitud.metodo_pago_sugerido,
        })
