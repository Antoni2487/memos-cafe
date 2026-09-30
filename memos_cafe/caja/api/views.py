from rest_framework import mixins
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from memos_cafe.caja.api.serializers import AbrirCajaSerializer
from memos_cafe.caja.api.serializers import CajaReadSerializer
from memos_cafe.caja.api.serializers import CerrarCajaSerializer
from memos_cafe.caja.api.serializers import ComprobanteReadSerializer
from memos_cafe.caja.api.serializers import ComprobanteWriteSerializer
from memos_cafe.caja.api.serializers import MovimientoCajaReadSerializer
from memos_cafe.caja.api.serializers import MovimientoCajaSerializer
from memos_cafe.caja.api.serializers import NotaCreditoWriteSerializer
from memos_cafe.caja.api.serializers import PagoReadSerializer
from memos_cafe.caja.api.serializers import PagoWriteSerializer
from memos_cafe.caja.models import Caja
from memos_cafe.caja.models import Comprobante
from memos_cafe.caja.models import MovimientoCaja
from memos_cafe.caja.models import Pago
from memos_cafe.caja.services import CajaService
from memos_cafe.caja.services import ComprobanteService
from memos_cafe.caja.services import PagoService
from memos_cafe.utils.permissions import EsAdmin
from memos_cafe.utils.permissions import EsAdminOCajero
from memos_cafe.utils.permissions import modulo_requerido


class CajaViewSet(GenericViewSet):
    """
    Gestión de sesiones de caja.
    El ViewSet solo maneja HTTP — delega toda la lógica a CajaService.
    """

    permission_classes = [EsAdminOCajero, modulo_requerido("caja")]
    queryset = Caja.objects.all()

    @action(detail=False, methods=["get"], url_path="estado")
    def estado(self, request):
        """GET /api/caja/estado/ — sesión actualmente abierta."""
        caja = Caja.objects.get_sesion_abierta()
        if not caja:
            return Response(
                {"detail": "No hay ninguna sesión de caja abierta."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(CajaReadSerializer(caja).data)

    @action(detail=False, methods=["post"], url_path="abrir")
    def abrir(self, request):
        """POST /api/caja/abrir/"""
        serializer = AbrirCajaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            caja = CajaService.abrir_sesion(
                usuario=request.user,
                monto_inicial=serializer.validated_data["monto_inicial"],
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CajaReadSerializer(caja).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="cerrar")
    def cerrar(self, request):
        """POST /api/caja/cerrar/"""
        serializer = CerrarCajaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            caja = CajaService.cerrar_sesion(
                monto_final=serializer.validated_data["monto_final"],
                observaciones=serializer.validated_data.get("observaciones", ""),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CajaReadSerializer(caja).data)


class MovimientoCajaViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    GenericViewSet,
):
    """Movimientos de efectivo dentro de una sesión de caja."""

    permission_classes = [EsAdminOCajero, modulo_requerido("caja")]

    def get_serializer_class(self):
        if self.action == "create":
            return MovimientoCajaSerializer
        return MovimientoCajaReadSerializer

    def get_queryset(self):
        caja = Caja.objects.get_sesion_abierta()
        if not caja:
            return MovimientoCaja.objects.none()
        return caja.movimientos.all()

    def create(self, request, *args, **kwargs):
        serializer = MovimientoCajaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            movimiento = CajaService.registrar_movimiento(
                tipo=serializer.validated_data["tipo"],
                monto=serializer.validated_data["monto"],
                motivo=serializer.validated_data["motivo"],
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            MovimientoCajaReadSerializer(movimiento).data,
            status=status.HTTP_201_CREATED,
        )


class PagoViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    """
    Gestión de pagos.
    El create va en un action separado para mayor control.
    """

    permission_classes = [EsAdminOCajero, modulo_requerido("caja")]
    # ?caja=<id> limita el listado a los pagos de una sesion: sin el filtro
    # se devuelve el historial completo (paginado), no solo el turno actual.
    filterset_fields = ["caja", "estado"]

    def get_queryset(self):
        return Pago.objects.con_orden_completa()

    def get_serializer_class(self):
        return PagoReadSerializer

    @action(detail=False, methods=["post"], url_path="procesar")
    def procesar(self, request):
        """POST /api/pagos/procesar/ — cobra una orden."""
        serializer = PagoWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            pago = PagoService.procesar_pago(
                orden=serializer.validated_data["orden"],
                metodo_pago=serializer.validated_data["metodo_pago"],
                monto=serializer.validated_data["monto"],
                monto_recibido=serializer.validated_data.get("monto_recibido"),
                numero_operacion=serializer.validated_data.get("numero_operacion", ""),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PagoReadSerializer(pago).data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["post"],
        url_path="anular",
        permission_classes=[EsAdmin],
    )
    def anular(self, request, pk=None):
        """POST /api/pagos/{id}/anular/ — solo admin. Requiere motivo
        (genera nota de credito interna; la orden NO se reabre)."""
        pago = self.get_object()
        serializer = NotaCreditoWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            PagoService.anular_pago(
                pago,
                motivo=serializer.validated_data["motivo"],
                detalle=serializer.validated_data.get("detalle", ""),
                usuario=request.user,
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PagoReadSerializer(pago).data)


class ComprobanteViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    """Emisión y consulta de comprobantes."""

    permission_classes = [EsAdminOCajero, modulo_requerido("caja")]
    queryset = Comprobante.objects.select_related("pago").all()

    def get_serializer_class(self):
        return ComprobanteReadSerializer

    @action(detail=False, methods=["post"], url_path="emitir")
    def emitir(self, request):
        """POST /api/comprobantes/emitir/"""
        serializer = ComprobanteWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            comprobante = ComprobanteService.emitir(**serializer.validated_data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            ComprobanteReadSerializer(comprobante).data,
            status=status.HTTP_201_CREATED,
        )
