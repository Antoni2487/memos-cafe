from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import GenericViewSet
from rest_framework.viewsets import ModelViewSet

from memos_cafe.mesas.api.serializers import ElementoPlanoSerializer
from memos_cafe.mesas.api.serializers import MesaEstadoSerializer
from memos_cafe.mesas.api.serializers import MesaPlanoSerializer
from memos_cafe.mesas.api.serializers import MesaSerializer
from memos_cafe.mesas.api.serializers import PedidoPorConfirmarSerializer
from memos_cafe.mesas.api.serializers import PlanoGuardarSerializer
from memos_cafe.mesas.models import PLANO_ALTO
from memos_cafe.mesas.models import PLANO_ANCHO
from memos_cafe.mesas.models import Mesa
from memos_cafe.mesas.services import MesaService
from memos_cafe.mesas.services import PlanoService
from memos_cafe.mesas.services import SesionMesaService
from memos_cafe.utils.permissions import EsAdmin
from memos_cafe.utils.permissions import EsAdminOMesero
from memos_cafe.utils.permissions import EsPersonalDeSala
from memos_cafe.utils.permissions import TodosAutenticados
from memos_cafe.utils.permissions import modulo_requerido


class MesaViewSet(ModelViewSet):
    """
    list:   GET  /api/mesas/          -> todos los roles
    create: POST /api/mesas/          -> solo admin
    update: PUT  /api/mesas/{id}/     -> solo admin
    destroy:DELETE /api/mesas/{id}/   -> solo admin (da de baja)
    estado: PATCH /api/mesas/{id}/estado/ -> admin o mesero
    """

    queryset = Mesa.objects.filter(activo=True).order_by("numero")
    serializer_class = MesaSerializer

    def get_permissions(self):
        # list/retrieve quedan sin el gate de PermisoRol a proposito: Ordenes
        # necesita leer mesas para el selector de mesa aunque el modulo
        # "Mesas" (gestion/CRUD) este deshabilitado para el rol.
        if self.action in ["list", "retrieve"]:
            return [TodosAutenticados()]
        if self.action == "estado":
            return [EsAdminOMesero(), modulo_requerido("mesas")()]
        return [EsAdmin(), modulo_requerido("mesas")()]

    def get_serializer_class(self):
        if self.action == "estado":
            return MesaEstadoSerializer
        return MesaSerializer

    def perform_create(self, serializer):
        try:
            mesa = MesaService.crear(**serializer.validated_data)
        except ValueError as e:
            raise ValidationError({"detail": str(e)}) from e
        serializer.instance = mesa

    def perform_update(self, serializer):
        try:
            MesaService.actualizar(serializer.instance, **serializer.validated_data)
        except ValueError as e:
            raise ValidationError({"detail": str(e)}) from e

    def destroy(self, request, *args, **kwargs):
        """En vez de borrar fisicamente, da de baja la mesa."""
        mesa = self.get_object()
        try:
            MesaService.dar_de_baja(mesa)
        except ValueError as e:
            raise ValidationError({"detail": str(e)}) from e
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["patch"], url_path="estado")
    def estado(self, request, pk=None):
        mesa = self.get_object()
        serializer = MesaEstadoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        nuevo_estado = serializer.validated_data["estado"]

        try:
            MesaService.cambiar_estado(mesa, nuevo_estado)
        except ValueError as e:
            raise ValidationError({"detail": str(e)}) from e

        return Response(MesaSerializer(mesa).data)

    @action(detail=True, methods=["post"], url_path="regenerar-qr")
    def regenerar_qr(self, request, pk=None):
        """POST /api/mesas/{id}/regenerar-qr/ — solo admin. Invalida el QR
        impreso de la mesa y genera uno nuevo (hay que reimprimirlo)."""
        mesa = MesaService.regenerar_codigo_qr(self.get_object())
        return Response(MesaSerializer(mesa).data)


class PedidoPorConfirmarViewSet(GenericViewSet):
    """Primeros pedidos por QR de mesas libres, esperando a un mesero.

    GET  /api/mesas/pedidos-por-confirmar/                 pendientes
    POST /api/mesas/pedidos-por-confirmar/{id}/confirmar/  hay gente: pasa a Cocina
    POST /api/mesas/pedidos-por-confirmar/{id}/rechazar/   mesa vacia
    """

    serializer_class = PedidoPorConfirmarSerializer
    permission_classes = [EsPersonalDeSala]

    def get_queryset(self):
        return SesionMesaService.pendientes()

    def list(self, request):
        return Response(self.get_serializer(self.get_queryset(), many=True).data)

    @action(detail=True, methods=["post"], url_path="confirmar")
    def confirmar(self, request, pk=None):
        pedido = self.get_object()
        try:
            orden = SesionMesaService.confirmar_pedido(pedido, mesero=request.user)
        except ValueError as e:
            raise ValidationError({"detail": str(e)}) from e
        return Response({"orden_id": orden.id, "mesa_numero": pedido.mesa.numero})

    @action(detail=True, methods=["post"], url_path="rechazar")
    def rechazar(self, request, pk=None):
        pedido = self.get_object()
        try:
            SesionMesaService.rechazar_pedido(pedido, mesero=request.user)
        except ValueError as e:
            raise ValidationError({"detail": str(e)}) from e
        return Response(status=status.HTTP_204_NO_CONTENT)


class PlanoView(APIView):
    """Croquis del salon.

    GET /api/mesas/plano/  personal de sala: mesas con su posicion y lo que
                           pasa en cada una, mas la barra, paredes, etc.
    PUT /api/mesas/plano/  admin: guarda el croquis armado en el editor.
                           Agregar o quitar mesas: POST y DELETE /api/mesas/.
    """

    def get_permissions(self):
        if self.request.method == "GET":
            return [EsPersonalDeSala()]
        return [EsAdmin(), modulo_requerido("mesas")()]

    def get(self, request):
        return Response(self._plano())

    def put(self, request):
        serializer = PlanoGuardarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            PlanoService.guardar(**serializer.validated_data)
        except ValueError as e:
            raise ValidationError({"detail": str(e)}) from e
        return Response(self._plano())

    @staticmethod
    def _plano():
        return {
            "ancho": PLANO_ANCHO,
            "alto": PLANO_ALTO,
            "siguiente_numero": MesaService.siguiente_numero(),
            "mesas": MesaPlanoSerializer(
                PlanoService.mesas(),
                many=True,
                context={"resumen": PlanoService.resumen_sala()},
            ).data,
            "elementos": ElementoPlanoSerializer(
                PlanoService.elementos(),
                many=True,
            ).data,
        }
