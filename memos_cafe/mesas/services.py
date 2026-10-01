from datetime import timedelta

from django.db import models
from django.db import transaction
from django.utils import timezone

# Cruce a otras apps de negocio (ordenes/caja) permitido en la capa de
# servicios — igual patron que ordenes/services.py importando Mesa/Caja.
# Las vistas de mesas/api/ nunca importan estos modulos directo (ver
# .importlinter, contrato "vistas-no-cruzan-apps-de-negocio"): siempre
# pasan por SesionMesaService, que es quien conoce el cruce.
from memos_cafe.caja.models import SolicitudCobro
from memos_cafe.mesas.models import ElementoPlano
from memos_cafe.mesas.models import Mesa
from memos_cafe.mesas.models import PedidoPorConfirmar
from memos_cafe.mesas.models import SesionMesaQR
from memos_cafe.mesas.models import generar_codigo_qr
from memos_cafe.ordenes.models import Comanda
from memos_cafe.ordenes.models import DetalleOrden
from memos_cafe.ordenes.models import Orden
from memos_cafe.ordenes.services import DetalleOrdenService
from memos_cafe.ordenes.services import OrdenService
from memos_cafe.productos.models import Producto
from memos_cafe.productos.models import Promocion
from memos_cafe.realtime.notificar import notificar

CAMPOS_PLANO = ("plano_x", "plano_y", "plano_ancho", "plano_alto", "forma", "rotacion")


class MesaService:
    @staticmethod
    def crear(numero: int, capacidad: int, **plano) -> Mesa:
        """Agrega una mesa (desde la gestion de mesas o el editor del
        croquis). Si ya hubo una mesa con ese numero y se dio de baja, la
        reactiva con su mismo QR: quitar y volver a poner una mesa no
        obliga a reimprimir nada."""
        if capacidad <= 0:
            msg = "La capacidad debe ser mayor a 0."
            raise ValueError(msg)
        plano = {k: v for k, v in plano.items() if k in CAMPOS_PLANO}
        anterior = Mesa.objects.filter(numero=numero).first()
        if anterior is None:
            return Mesa.objects.create(numero=numero, capacidad=capacidad, **plano)
        if anterior.activo:
            msg = f"Ya existe una mesa con el número {numero}."
            raise ValueError(msg)
        anterior.activo = True
        anterior.fecha_baja = None
        anterior.estado = Mesa.Estado.LIBRE
        anterior.capacidad = capacidad
        for campo, valor in plano.items():
            setattr(anterior, campo, valor)
        anterior.save()
        return anterior

    @staticmethod
    def actualizar(
        mesa: Mesa,
        numero: int | None = None,
        capacidad: int | None = None,
        **plano,
    ) -> Mesa:
        if numero and numero != mesa.numero:
            if Mesa.objects.filter(numero=numero).exists():
                msg = f"Ya existe una mesa con el número {numero}."
                raise ValueError(msg)
            mesa.numero = numero
        if capacidad is not None:
            if capacidad <= 0:
                msg = "La capacidad debe ser mayor a 0."
                raise ValueError(msg)
            mesa.capacidad = capacidad
        cambios = [c for c in CAMPOS_PLANO if c in plano]
        for campo in cambios:
            setattr(mesa, campo, plano[campo])
        mesa.save(update_fields=["numero", "capacidad", *cambios])
        return mesa

    @staticmethod
    def siguiente_numero() -> int:
        """Numero sugerido al agregar una mesa: el menor que no este en uso."""
        en_uso = set(Mesa.objects.filter(activo=True).values_list("numero", flat=True))
        numero = 1
        while numero in en_uso:
            numero += 1
        return numero

    @staticmethod
    def dar_de_baja(mesa: Mesa) -> Mesa:
        if mesa.estado == Mesa.Estado.OCUPADA:
            msg = f"No se puede dar de baja la mesa {mesa.numero} porque está ocupada."
            raise ValueError(
                msg,
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
            msg = (
                f"No se puede cambiar el estado de '{mesa.estado}' "
                f"a '{nuevo_estado}' manualmente."
            )
            raise ValueError(
                msg,
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
            msg = f"La mesa {mesa.numero} no está libre para abrir un pedido por QR."
            raise ValueError(
                msg,
            )
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
            msg = f"La mesa {mesa.numero} no tiene una sesión de pedido por QR activa."
            raise ValueError(
                msg,
            )
        if Orden.objects.filter(mesa=mesa, estado=Orden.Estado.ABIERTA).exists():
            msg = (
                f"La mesa {mesa.numero} ya tiene un pedido en curso — "
                "anúlalo o ciérralo, eso libera la mesa automáticamente."
            )
            raise ValueError(
                msg,
            )
        mesa.liberar()

    # Un primer pedido que nadie confirma expira; a los ESCALA minutos se
    # marca como urgente en las alertas del admin (los cajeros ya reciben
    # el aviso desde el principio: escuchan el mismo canal que los meseros).
    MINUTOS_EXPIRA_POR_CONFIRMAR = 20
    MINUTOS_ESCALA_POR_CONFIRMAR = 3

    @staticmethod
    def orden_abierta(mesa: Mesa) -> Orden | None:
        return (
            Orden.objects.filter(mesa=mesa, estado=Orden.Estado.ABIERTA)
            .order_by("-fecha_creacion")
            .first()
        )

    @staticmethod
    def orden_abierta_para_cliente(mesa: Mesa) -> Orden | None:
        """La orden abierta con todo lo que ve el cliente en su celular
        (items, rondas y si pidio la cuenta), en un numero fijo de consultas:
        esta pantalla se consulta cada pocos segundos."""
        return (
            Orden.objects.filter(mesa=mesa, estado=Orden.Estado.ABIERTA)
            .prefetch_related(
                models.Prefetch(
                    "detalles",
                    queryset=DetalleOrden.objects.select_related(
                        "producto",
                        "promocion",
                    ),
                ),
                "comandas",
                "solicitudes_cobro",
            )
            .order_by("-fecha_creacion")
            .first()
        )

    @staticmethod
    @transaction.atomic
    def registrar_pedido(mesa: Mesa, items: list[dict]) -> Orden | PedidoPorConfirmar:
        """Pedido del cliente desde el QR:

        - la mesa ya tiene una orden abierta: es una ronda mas, va directo
          a Cocina como comanda nueva;
        - un mesero abrio la mesa (sesion activa) pero aun no hay orden:
          se crea la orden directo, a nombre de ese mesero;
        - la mesa estaba libre: queda como PedidoPorConfirmar hasta que un
          mesero lo confirme. Si ya habia uno pendiente (otro celular de la
          misma mesa), los items se suman a ese.
        """
        mesa = Mesa.objects.select_for_update().get(pk=mesa.pk)

        orden = SesionMesaService.orden_abierta(mesa)
        if orden is not None:
            DetalleOrdenService.agregar_ronda(orden, items, origen=Comanda.Origen.QR)
            orden.refresh_from_db()
            return orden

        sesion = SesionMesaService.sesion_activa(mesa)
        if sesion is not None:
            return OrdenService.crear_orden(
                usuario=sesion.mesero,
                tipo_orden=Orden.TipoOrden.MESA,
                mesa=mesa,
                detalles=items,
                mesa_ya_ocupada=True,  # abrir_sesion() ya la ocupo al abrir
                origen=Comanda.Origen.QR,
            )

        SesionMesaService.expirar_vencidos()
        pedido = PedidoPorConfirmar.objects.filter(
            mesa=mesa,
            estado=PedidoPorConfirmar.Estado.PENDIENTE,
        ).first()
        if pedido is None:
            pedido = PedidoPorConfirmar(mesa=mesa, items=[])
        pedido.items = [*pedido.items, *(_item_a_json(item) for item in items)]
        pedido.save()
        notificar(["meseros"], _evento_por_confirmar(pedido, "pedido.por_confirmar"))
        return pedido

    @staticmethod
    @transaction.atomic
    def confirmar_pedido(pedido: PedidoPorConfirmar, mesero) -> Orden:
        """El mesero ve gente en la mesa y confirma: se abre la sesion, se
        crea la orden a su nombre y el pedido pasa a Cocina."""
        pedido = SesionMesaService._pendiente_bloqueado(pedido)
        mesa = Mesa.objects.select_for_update().get(pk=pedido.mesa_id)
        items = [_item_desde_json(item) for item in pedido.items]

        orden = SesionMesaService.orden_abierta(mesa)
        if orden is not None:
            # Mientras tanto alguien abrio la mesa a mano: va como ronda.
            DetalleOrdenService.agregar_ronda(orden, items, origen=Comanda.Origen.QR)
        else:
            if SesionMesaService.sesion_activa(mesa) is None:
                if mesa.estado == Mesa.Estado.OCUPADA:
                    msg = (
                        f"La mesa {mesa.numero} figura ocupada sin un pedido. "
                        "Libérala y vuelve a confirmar."
                    )
                    raise ValueError(msg)
                SesionMesaQR.objects.create(mesa=mesa, mesero=mesero)
                mesa.ocupar()
            orden = OrdenService.crear_orden(
                usuario=mesero,
                tipo_orden=Orden.TipoOrden.MESA,
                mesa=mesa,
                detalles=items,
                mesa_ya_ocupada=True,
                origen=Comanda.Origen.QR,
            )

        SesionMesaService._resolver(
            pedido,
            PedidoPorConfirmar.Estado.CONFIRMADO,
            mesero,
            orden,
        )
        return orden

    @staticmethod
    @transaction.atomic
    def rechazar_pedido(pedido: PedidoPorConfirmar, mesero) -> PedidoPorConfirmar:
        """La mesa esta vacia: alguien pidio con una foto del QR."""
        pedido = SesionMesaService._pendiente_bloqueado(pedido)
        SesionMesaService._resolver(pedido, PedidoPorConfirmar.Estado.RECHAZADO, mesero)
        return pedido

    @staticmethod
    def expirar_vencidos() -> int:
        limite = timezone.now() - timedelta(
            minutes=SesionMesaService.MINUTOS_EXPIRA_POR_CONFIRMAR,
        )
        vencidos = list(
            PedidoPorConfirmar.objects.filter(
                estado=PedidoPorConfirmar.Estado.PENDIENTE,
                actualizado_en__lt=limite,
            ).select_related("mesa"),
        )
        for pedido in vencidos:
            SesionMesaService._resolver(pedido, PedidoPorConfirmar.Estado.EXPIRADO)
        return len(vencidos)

    @staticmethod
    def pendientes():
        SesionMesaService.expirar_vencidos()
        return PedidoPorConfirmar.objects.filter(
            estado=PedidoPorConfirmar.Estado.PENDIENTE,
        ).select_related("mesa")

    @staticmethod
    def ultimo_pedido_no_confirmado(mesa: Mesa) -> PedidoPorConfirmar | None:
        """Para la pantalla del cliente: el pendiente, o el ultimo que fue
        rechazado o expiro hace poco (para poder explicarle que paso)."""
        SesionMesaService.expirar_vencidos()
        reciente = timezone.now() - timedelta(minutes=30)
        return (
            PedidoPorConfirmar.objects.filter(mesa=mesa, creado_en__gte=reciente)
            .exclude(estado=PedidoPorConfirmar.Estado.CONFIRMADO)
            .order_by("-creado_en")
            .first()
        )

    @staticmethod
    def _pendiente_bloqueado(pedido: PedidoPorConfirmar) -> PedidoPorConfirmar:
        pedido = (
            PedidoPorConfirmar.objects.select_for_update()
            .select_related("mesa")
            .get(
                pk=pedido.pk,
            )
        )
        if pedido.estado != PedidoPorConfirmar.Estado.PENDIENTE:
            msg = f"Este pedido ya fue {pedido.get_estado_display().lower()}."
            raise ValueError(msg)
        return pedido

    @staticmethod
    def _resolver(pedido, estado, mesero=None, orden=None) -> None:
        pedido.estado = estado
        pedido.resuelto_en = timezone.now()
        pedido.resuelto_por = mesero
        pedido.orden = orden
        pedido.save(update_fields=["estado", "resuelto_en", "resuelto_por", "orden"])
        notificar(
            ["meseros"],
            _evento_por_confirmar(pedido, "pedido.por_confirmar_resuelto"),
        )

    @staticmethod
    def solicitar_cobro(mesa: Mesa, metodo_pago_sugerido: str) -> SolicitudCobro:
        orden = (
            Orden.objects.filter(
                mesa=mesa,
                estado=Orden.Estado.ABIERTA,
            )
            .order_by("-fecha_creacion")
            .first()
        )
        if orden is None:
            msg = f"No hay una orden abierta para la mesa {mesa.numero}."
            raise ValueError(msg)
        solicitud = SolicitudCobro.objects.create(
            orden=orden,
            metodo_pago_sugerido=metodo_pago_sugerido,
        )
        SesionMesaService._notificar_solicitud_cobro(mesa, solicitud)
        return solicitud

    @staticmethod
    def _notificar_solicitud_cobro(mesa: Mesa, solicitud: SolicitudCobro) -> None:
        """Avisa en vivo a mesero y cajero — el admin ya se entera de esto
        via el polling de /api/alertas/ (AlertasView), asi que no hace
        falta duplicarlo aca. Ver memos_cafe/realtime/notificar.py."""
        notificar(
            ["meseros"],
            {
                "type": "solicitud_cobro.nueva",
                "mesa_numero": mesa.numero,
                "metodo_pago_sugerido": solicitud.metodo_pago_sugerido,
            },
        )


class PlanoService:
    """Croquis del salon: donde esta cada mesa, la barra, las paredes, y
    que pasa en cada mesa ocupada (para la vista del mesero)."""

    @staticmethod
    def mesas():
        return Mesa.objects.filter(activo=True).order_by("numero")

    @staticmethod
    def elementos():
        return ElementoPlano.objects.all()

    @staticmethod
    @transaction.atomic
    def guardar(mesas: list[dict], elementos: list[dict]) -> None:
        """Guarda el croquis completo tal como quedo en el editor.

        - mesas: posicion y forma de cada mesa activa ({"id", campos...}).
          Agregar o quitar mesas va por MesaService.crear / dar_de_baja.
        - elementos: la lista completa. Los que traen id se actualizan, los
          que no se crean, y los que ya no vienen se borran.
        """
        activas = {
            m.id: m for m in Mesa.objects.select_for_update().filter(activo=True)
        }
        for datos in mesas:
            mesa = activas.get(datos["id"])
            if mesa is None:
                msg = f"La mesa {datos['id']} no existe o fue dada de baja."
                raise ValueError(msg)
            for campo in CAMPOS_PLANO:
                if campo in datos:
                    setattr(mesa, campo, datos[campo])
        Mesa.objects.bulk_update(
            [activas[d["id"]] for d in mesas],
            CAMPOS_PLANO,
        )

        existentes = {e.id: e for e in ElementoPlano.objects.select_for_update()}
        campos = ("tipo", "etiqueta", *CAMPOS_PLANO)
        conservar, nuevos = [], []
        for datos in elementos:
            valores = {c: datos[c] for c in campos if c in datos}
            if datos.get("id") is None:
                nuevos.append(ElementoPlano(**valores))
                continue
            elemento = existentes.get(datos["id"])
            if elemento is None:
                msg = f"El elemento {datos['id']} del plano no existe."
                raise ValueError(msg)
            for campo, valor in valores.items():
                setattr(elemento, campo, valor)
            conservar.append(elemento)
        ElementoPlano.objects.bulk_update(conservar, campos)
        ElementoPlano.objects.exclude(pk__in=[e.id for e in conservar]).delete()
        ElementoPlano.objects.bulk_create(nuevos)

    @staticmethod
    def resumen_sala() -> dict[int, dict]:
        """Lo que el mesero necesita ver de cada mesa con movimiento, por
        id de mesa: la orden abierta, como van sus comandas, si pidieron la
        cuenta y si hay un primer pedido por QR esperando confirmacion.
        Cuatro consultas en total, sin importar cuantas mesas haya."""
        resumen: dict[int, dict] = {}
        ordenes = (
            Orden.objects.filter(
                estado=Orden.Estado.ABIERTA,
                mesa__activo=True,
            )
            .select_related("usuario")
            .order_by("fecha_creacion")
        )
        por_orden = {}
        for orden in ordenes:
            if orden.mesa_id in resumen:
                continue  # dato viejo: mas de una orden abierta en la mesa
            usuario = orden.usuario
            datos = _resumen_vacio()
            datos.update(
                orden_id=orden.id,
                total=orden.total,
                abierta_en=orden.fecha_creacion,
                cliente_nombre=orden.cliente_nombre,
                mesero=(usuario.name or usuario.email) if usuario else "",
            )
            resumen[orden.mesa_id] = por_orden[orden.id] = datos

        comandas = Comanda.objects.filter(orden_id__in=por_orden).values_list(
            "orden_id",
            "estado",
            "creada_en",
        )
        for orden_id, estado, creada_en in comandas:
            datos = por_orden[orden_id]
            datos["comandas"][estado] += 1
            esperando = datos["comanda_esperando_desde"]
            if estado != Comanda.Estado.ENTREGADA and (
                esperando is None or creada_en < esperando
            ):
                datos["comanda_esperando_desde"] = creada_en

        cuentas = SolicitudCobro.objects.filter(
            orden_id__in=por_orden,
            atendido_en__isnull=True,
        ).values_list("orden_id", "metodo_pago_sugerido")
        metodos = dict(SolicitudCobro._meta.get_field("metodo_pago_sugerido").choices)
        for orden_id, metodo in cuentas:
            por_orden[orden_id]["pide_cuenta"] = True
            por_orden[orden_id]["metodo_cuenta"] = metodos.get(metodo, metodo)

        for pedido in SesionMesaService.pendientes():
            resumen.setdefault(pedido.mesa_id, _resumen_vacio())
            resumen[pedido.mesa_id]["pedido_por_confirmar_id"] = pedido.id
        return resumen


def _resumen_vacio() -> dict:
    return {
        "orden_id": None,
        "total": None,
        "abierta_en": None,
        "cliente_nombre": "",
        "mesero": "",
        "comandas": dict.fromkeys(Comanda.Estado.values, 0),
        "comanda_esperando_desde": None,
        "pide_cuenta": False,
        "metodo_cuenta": None,
        "pedido_por_confirmar_id": None,
    }


def _item_a_json(item: dict) -> dict:
    producto = item.get("producto")
    promocion = item.get("promocion")
    base = producto or promocion
    return {
        "producto": producto.pk if producto else None,
        "promocion": promocion.pk if promocion else None,
        "cantidad": item["cantidad"],
        "nota": item.get("nota", ""),
        "nombre": base.nombre,
        "precio": str(base.precio),
    }


def _item_desde_json(item: dict) -> dict:
    """Vuelve a buscar los productos al confirmar: si alguno dejo de estar
    disponible mientras tanto, se avisa en vez de venderlo igual."""
    datos = {"cantidad": item["cantidad"], "nota": item.get("nota", "")}
    if item.get("producto"):
        producto = Producto.objects.filter(pk=item["producto"], disponible=True).first()
        if producto is None:
            msg = f"'{item['nombre']}' ya no esta disponible."
            raise ValueError(msg)
        datos["producto"] = producto
    if item.get("promocion"):
        promocion = Promocion.objects.filter(pk=item["promocion"], activo=True).first()
        if promocion is None:
            msg = f"La promocion '{item['nombre']}' ya no esta vigente."
            raise ValueError(msg)
        datos["promocion"] = promocion
    return datos


def _evento_por_confirmar(pedido: PedidoPorConfirmar, tipo: str) -> dict:
    return {
        "type": tipo,
        "pedido_id": pedido.id,
        "mesa_numero": pedido.mesa.numero,
        "estado": pedido.estado,
        "cantidad_items": sum(item["cantidad"] for item in pedido.items),
    }
