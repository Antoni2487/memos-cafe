from decimal import Decimal

from rest_framework import mixins
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser
from rest_framework.parsers import JSONParser
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet

from memos_cafe.productos.api.serializers import CategoriaSerializer
from memos_cafe.productos.api.serializers import ProductoEditarSerializer
from memos_cafe.productos.api.serializers import ProductoSerializer
from memos_cafe.productos.api.serializers import ProductoWriteSerializer
from memos_cafe.productos.api.serializers import PromocionEditarSerializer
from memos_cafe.productos.api.serializers import PromocionSerializer
from memos_cafe.productos.api.serializers import PromocionWriteSerializer
from memos_cafe.productos.models import Categoria
from memos_cafe.productos.models import Producto
from memos_cafe.productos.models import Promocion
from memos_cafe.productos.services import CategoriaService
from memos_cafe.productos.services import ProductoService
from memos_cafe.productos.services import PromocionService
from memos_cafe.utils.permissions import EsAdmin
from memos_cafe.utils.permissions import TodosAutenticados
from memos_cafe.utils.throttles import CatalogoPublicoThrottle

# Categoria "de sistema" que crea la migracion 0003_descartables.
CATEGORIA_DESCARTABLES = "Descartables"


class CategoriaViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    serializer_class = CategoriaSerializer

    def get_queryset(self):
        if self.request.user.groups.filter(name="admin").exists():
            return Categoria.objects.all()
        return Categoria.objects.filter(activo=True)

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [TodosAutenticados()]
        return [EsAdmin()]

    @action(
        detail=False,
        methods=["post"],
        url_path="crear",
        permission_classes=[EsAdmin],
    )
    def crear(self, request):
        """POST /api/productos/categorias/crear/"""
        serializer = CategoriaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            categoria = CategoriaService.crear(
                nombre=serializer.validated_data["nombre"],
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            CategoriaSerializer(categoria).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["patch"],
        url_path="editar",
        permission_classes=[EsAdmin],
    )
    def editar(self, request, pk=None):
        """PATCH /api/productos/categorias/{id}/editar/"""
        categoria = self.get_object()
        nombre = request.data.get("nombre", "").strip()
        try:
            CategoriaService.editar(categoria, nombre)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CategoriaSerializer(categoria).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="activar",
        permission_classes=[EsAdmin],
    )
    def activar(self, request, pk=None):
        """POST /api/productos/categorias/{id}/activar/"""
        categoria = self.get_object()
        CategoriaService.activar(categoria)
        return Response(CategoriaSerializer(categoria).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="desactivar",
        permission_classes=[EsAdmin],
    )
    def desactivar(self, request, pk=None):
        """POST /api/productos/categorias/{id}/desactivar/"""
        categoria = self.get_object()
        try:
            CategoriaService.desactivar(categoria)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CategoriaSerializer(categoria).data)


class ProductoViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        if self.request.user.groups.filter(name="admin").exists():
            return Producto.objects.con_categoria()
        return Producto.objects.disponibles()

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [TodosAutenticados()]
        if self.action == "publico":
            return []
        return [EsAdmin()]

    def get_serializer_class(self):
        return ProductoSerializer

    @action(
        detail=False,
        methods=["post"],
        url_path="crear",
        permission_classes=[EsAdmin],
    )
    def crear(self, request):
        """POST /api/productos/crear/"""
        serializer = ProductoWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            producto = ProductoService.crear(**serializer.validated_data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            ProductoSerializer(producto).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["patch"],
        url_path="editar",
        permission_classes=[EsAdmin],
    )
    def editar(self, request, pk=None):
        """PATCH /api/productos/{id}/editar/"""
        producto = self.get_object()
        serializer = ProductoEditarSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            ProductoService.editar(producto, **serializer.validated_data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductoSerializer(producto).data)

    @action(
        detail=True,
        methods=["patch"],
        url_path="precio",
        permission_classes=[EsAdmin],
    )
    def actualizar_precio(self, request, pk=None):
        """PATCH /api/productos/{id}/precio/"""
        producto = self.get_object()
        precio = request.data.get("precio")
        if precio is None:
            return Response(
                {"detail": "El campo 'precio' es requerido."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            ProductoService.actualizar_precio(producto, Decimal(str(precio)))
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductoSerializer(producto).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="activar",
        permission_classes=[EsAdmin],
    )
    def activar(self, request, pk=None):
        """POST /api/productos/{id}/activar/"""
        producto = self.get_object()
        producto.activar()
        return Response(ProductoSerializer(producto).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="desactivar",
        permission_classes=[EsAdmin],
    )
    def desactivar(self, request, pk=None):
        """POST /api/productos/{id}/desactivar/"""
        producto = self.get_object()
        producto.desactivar()
        return Response(ProductoSerializer(producto).data)

    @action(
        detail=False,
        methods=["get"],
        url_path="publico",
        permission_classes=[],
        throttle_classes=[CatalogoPublicoThrottle],
    )
    def publico(self, request):
        """GET /api/productos/publico/ — catálogo sin login, para el
        pedido por QR. Mismo serializer que list(), sin datos sensibles."""
        # Los descartables (bolsas y envases para llevar) los agrega el
        # personal; no se ofrecen en la carta del cliente sentado en la mesa.
        productos = Producto.objects.disponibles().exclude(
            categoria__nombre=CATEGORIA_DESCARTABLES,
        )
        # Con request en el contexto las fotos salen con URL completa: el
        # celular del cliente las pide al dominio de la API, no al del front.
        return Response(
            ProductoSerializer(productos, many=True, context={"request": request}).data,
        )


class PromocionViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    GenericViewSet,
):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        if self.request.user.groups.filter(name="admin").exists():
            return Promocion.objects.all()
        return Promocion.objects.vigentes()

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [TodosAutenticados()]
        if self.action == "publico":
            return []
        return [EsAdmin()]

    def get_serializer_class(self):
        return PromocionSerializer

    @action(
        detail=False,
        methods=["post"],
        url_path="crear",
        permission_classes=[EsAdmin],
    )
    def crear(self, request):
        """POST /api/productos/promociones/crear/"""
        serializer = PromocionWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            promocion = PromocionService.crear(**serializer.validated_data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            PromocionSerializer(promocion).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["patch"],
        url_path="editar",
        permission_classes=[EsAdmin],
    )
    def editar(self, request, pk=None):
        """PATCH /api/productos/promociones/{id}/editar/"""
        promocion = self.get_object()
        serializer = PromocionEditarSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        try:
            PromocionService.editar(promocion, **serializer.validated_data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(PromocionSerializer(promocion).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="activar",
        permission_classes=[EsAdmin],
    )
    def activar(self, request, pk=None):
        """POST /api/productos/promociones/{id}/activar/"""
        promocion = self.get_object()
        PromocionService.activar(promocion)
        return Response(PromocionSerializer(promocion).data)

    @action(
        detail=True,
        methods=["post"],
        url_path="desactivar",
        permission_classes=[EsAdmin],
    )
    def desactivar(self, request, pk=None):
        """POST /api/productos/promociones/{id}/desactivar/"""
        promocion = self.get_object()
        PromocionService.desactivar(promocion)
        return Response(PromocionSerializer(promocion).data)

    @action(
        detail=False,
        methods=["get"],
        url_path="publico",
        permission_classes=[],
        throttle_classes=[CatalogoPublicoThrottle],
    )
    def publico(self, request):
        """GET /api/productos/promociones/publico/ — vigentes, sin login."""
        promociones = Promocion.objects.vigentes()
        return Response(
            PromocionSerializer(
                promociones,
                many=True,
                context={"request": request},
            ).data,
        )
