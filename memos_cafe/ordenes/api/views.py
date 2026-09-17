from rest_framework import mixins, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from memos_cafe.ordenes.models import DetalleOrden, Orden
from memos_cafe.ordenes.services import DetalleOrdenService, OrdenService
from memos_cafe.ordenes.api.serializers import (
    ActualizarEstadoPreparacionSerializer,
    DetalleOrdenWriteSerializer,
    MarcarImpresoSerializer,
    OrdenReadSerializer,
    OrdenWriteSerializer,
    TicketCocinaSerializer,
)
from memos_cafe.utils.permissions import (
    EsAdmin,
    EsAdminOCocina,
    EsAdminOMesero,
    TodosAutenticados,
    modulo_requerido,
)


class OrdenViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    """
    Gestión de órdenes.
    El ViewSet solo maneja HTTP — delega lógica a OrdenService.

    Permisos:
      list / retrieve      → todos los autenticados
      crear / detalles     → admin o mesero
      anular               → solo admin
    """

    def get_queryset(self):
        user = self.request.user
        qs = Orden.objects.con_detalles()

        # Mesero: todas sus propias órdenes del día (todos los estados)
        # Incluye cerradas/anuladas para contexto y trazabilidad
        if user.groups.filter(name="mesero").exists():
            from django.utils import timezone
            return qs.filter(usuario=user, fecha_creacion__date=timezone.localdate())

        # Cajero: todas las órdenes del turno actual
        # Se delimita por fecha_apertura de la caja abierta (no por fecha del día)
        # Esto es correcto con 2 turnos/día: el cajero del turno 2 no ve el turno 1
        if user.groups.filter(name="cajero").exists():
            fecha_apertura = OrdenService.fecha_apertura_caja_actual()
            if fecha_apertura:
                return qs.filter(fecha_creacion__gte=fecha_apertura)
            return qs.none()  # sin turno activo: vista vacía

        # Cocina: todas las órdenes abiertas del día (para ver qué preparar)
        if user.groups.filter(name="cocina").exists():
            from django.utils import timezone
            return qs.filter(fecha_creacion__date=timezone.localdate())

        # Admin: todas las órdenes del día (todos los estados, todos los meseros)
        from django.utils import timezone
        return qs.filter(fecha_creacion__date=timezone.localdate())

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [TodosAutenticados(), modulo_requerido("ordenes")()]
        if self.action in ["crear", "agregar_detalle", "eliminar_detalle", "marcar_impreso"]:
            return [EsAdminOMesero(), modulo_requerido("ordenes")()]
        if self.action == "cocina":
            return [EsAdminOCocina(), modulo_requerido("ordenes_cocina")()]
        if self.action == "actualizar_estado_preparacion":
            # El mesero entra por el modulo "ordenes" (el mismo que ya
            # necesita para tomar pedidos) porque solo puede marcar
            # 'entregado' (retirar lo que Cocina dejo listo) -- no es
            # acceso al tablero de Cocina, ver el chequeo de mas abajo en
            # la vista. Cocina/admin siguen entrando por "ordenes_cocina".
            if self.request.user.groups.filter(name="mesero").exists():
                return [EsAdminOMesero(), modulo_requerido("ordenes")()]
            return [EsAdminOCocina(), modulo_requerido("ordenes_cocina")()]
        return [EsAdmin(), modulo_requerido("ordenes")()]

    def get_serializer_class(self):
        return OrdenReadSerializer

    @action(detail=False, methods=["post"], url_path="crear")
    def crear(self, request):
        """POST /api/ordenes/crear/ — crea una orden con sus ítems."""
        serializer = OrdenWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            orden = OrdenService.crear_orden(
                usuario=request.user,
                tipo_orden=data["tipo_orden"],
                mesa=data.get("mesa"),
                detalles=data["detalles"],
                cliente_nombre=data.get("cliente_nombre", ""),
                cliente_telefono=data.get("cliente_telefono", ""),
                direccion_entrega=data.get("direccion_entrega", ""),
                plataforma_delivery=data.get("plataforma_delivery") or "",
                plataforma_otra=data.get("plataforma_otra", ""),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrdenReadSerializer(orden).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="anular", permission_classes=[EsAdmin])
    def anular(self, request, pk=None):
        """POST /api/ordenes/{id}/anular/ — solo admin."""
        orden = self.get_object()
        try:
            OrdenService.anular_orden(orden)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        orden.refresh_from_db()  # Fix 5: asegurar estado actualizado antes de serializar
        return Response(OrdenReadSerializer(orden).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="detalles",
        permission_classes=[EsAdminOMesero],
    )
    def agregar_detalle(self, request, pk=None):
        """POST /api/ordenes/{id}/detalles/ — agrega un ítem."""
        orden = self.get_object()
        serializer = DetalleOrdenWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            DetalleOrdenService.agregar_detalle(orden=orden, **serializer.validated_data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        orden.refresh_from_db()
        return Response(OrdenReadSerializer(orden).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["delete"],
        url_path="detalles/(?P<detalle_id>[0-9]+)",
        permission_classes=[EsAdminOMesero],
    )
    def eliminar_detalle(self, request, pk=None, detalle_id=None):
        """DELETE /api/ordenes/{id}/detalles/{detalle_id}/"""
        orden = self.get_object()
        try:
            estaba_impreso = DetalleOrdenService.eliminar_detalle(
                orden=orden,
                detalle_id=int(detalle_id),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        orden.refresh_from_db()
        data = OrdenReadSerializer(orden).data
        data["item_eliminado_impreso"] = estaba_impreso
        return Response(data)

    @action(
        detail=True,
        methods=["post"],
        url_path="marcar-impreso",
        permission_classes=[EsAdminOMesero],
    )
    def marcar_impreso(self, request, pk=None):
        """POST /api/ordenes/{id}/marcar-impreso/ — marca ítems como enviados a cocina/barra."""
        orden = self.get_object()
        serializer = MarcarImpresoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        DetalleOrdenService.marcar_impreso(orden, serializer.validated_data["detalle_ids"])
        orden.refresh_from_db()
        return Response(OrdenReadSerializer(orden).data)

    @action(detail=False, methods=["get"], url_path="cocina")
    def cocina(self, request):
        """GET /api/ordenes/cocina/ — tickets abiertos con items por preparar
        o ya listos (sin entregar todavía), para el tablero de Cocina.
        Serializer liviano: nada de precios/pagos/datos de cliente."""
        ordenes = (
            Orden.objects.con_detalles()
            .filter(
                estado=Orden.Estado.ABIERTA,
                detalles__estado_preparacion__in=[
                    DetalleOrden.EstadoPreparacion.PENDIENTE,
                    DetalleOrden.EstadoPreparacion.EN_PREPARACION,
                    DetalleOrden.EstadoPreparacion.LISTO,
                ],
            )
            .distinct()
            .order_by("fecha_creacion")
        )
        return Response(TicketCocinaSerializer(ordenes, many=True).data)

    @action(
        detail=True,
        methods=["patch"],
        url_path=r"detalles/(?P<detalle_id>[0-9]+)/estado-preparacion",
    )
    def actualizar_estado_preparacion(self, request, pk=None, detalle_id=None):
        """PATCH /api/ordenes/{id}/detalles/{detalle_id}/estado-preparacion/
        — avanza el estado de preparación de un ítem. Cocina/admin pueden
        cualquier transición válida; el mesero solo puede marcar
        'entregado' (retirar el plato que Cocina ya dejó listo, nunca
        adelantarse a las transiciones que le corresponden a Cocina)."""
        orden = self.get_object()
        serializer = ActualizarEstadoPreparacionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        nuevo_estado = serializer.validated_data["estado_preparacion"]

        es_solo_mesero = (
            request.user.groups.filter(name="mesero").exists()
            and not request.user.groups.filter(name__in=["admin", "cocina"]).exists()
        )
        if es_solo_mesero and nuevo_estado != DetalleOrden.EstadoPreparacion.ENTREGADO:
            return Response(
                {"detail": "Un mesero solo puede marcar un ítem como entregado."},
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            detalle = orden.detalles.get(id=detalle_id)
        except DetalleOrden.DoesNotExist:
            return Response(
                {"detail": f"El item #{detalle_id} no existe en esta orden."},
                status=status.HTTP_404_NOT_FOUND,
            )
        try:
            DetalleOrdenService.actualizar_estado_preparacion(detalle, nuevo_estado)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        orden.refresh_from_db()
        return Response(TicketCocinaSerializer(orden).data)
