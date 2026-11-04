from decimal import Decimal

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from memos_cafe.productos.models import Categoria
from memos_cafe.productos.models import Producto
from memos_cafe.productos.models import ProductoImagen
from memos_cafe.productos.models import Promocion

# Portada + fotos adicionales. Suficiente para la galería de la carta QR sin
# volverla pesada de cargar en datos móviles.
MAX_FOTOS_POR_PRODUCTO = 6


class CategoriaService:
    @staticmethod
    def crear(nombre: str) -> Categoria:
        if Categoria.objects.filter(nombre__iexact=nombre).exists():
            msg = f"Ya existe una categoría con el nombre '{nombre}'."
            raise ValueError(msg)
        return Categoria.objects.create(nombre=nombre)

    @staticmethod
    def editar(categoria, nombre: str):
        nombre = nombre.strip()
        if not nombre:
            msg = "El nombre no puede estar vacío."
            raise ValueError(msg)
        if (
            Categoria.objects.filter(nombre__iexact=nombre)
            .exclude(pk=categoria.pk)
            .exists()
        ):
            msg = f"Ya existe una categoría con el nombre '{nombre}'."
            raise ValueError(msg)
        categoria.nombre = nombre
        categoria.save(update_fields=["nombre"])
        return categoria

    @staticmethod
    def activar(categoria: Categoria) -> Categoria:
        categoria.activo = True
        categoria.save(update_fields=["activo"])
        return categoria

    @staticmethod
    def desactivar(categoria: Categoria) -> Categoria:
        """
        Desactiva una categoría.
        Lanza ValueError si tiene productos disponibles asociados.
        """
        if categoria.productos.filter(disponible=True).exists():
            msg = (
                f"No se puede desactivar '{categoria.nombre}' "
                f"porque tiene productos disponibles asociados."
            )
            raise ValueError(msg)
        categoria.activo = False
        categoria.save(update_fields=["activo"])
        return categoria


class ProductoService:
    @staticmethod
    def crear(  # noqa: PLR0913 -- un parámetro por campo del producto
        nombre: str,
        precio: Decimal,
        categoria: Categoria,
        *,
        descripcion: str = "",
        disponible: bool = True,
        imagen=None,
    ) -> Producto:
        if precio <= 0:
            msg = "El precio debe ser mayor a 0."
            raise ValueError(msg)
        return Producto.objects.create(
            nombre=nombre,
            precio=precio,
            categoria=categoria,
            descripcion=descripcion,
            disponible=disponible,
            imagen=imagen,
        )

    @staticmethod
    def editar(producto: Producto, **kwargs) -> Producto:
        precio = kwargs.get("precio")
        if precio is not None and precio <= 0:
            msg = "El precio debe ser mayor a 0."
            raise ValueError(msg)
        for campo, valor in kwargs.items():
            setattr(producto, campo, valor)
        producto.save()
        return producto

    @staticmethod
    def actualizar_precio(producto: Producto, nuevo_precio: Decimal) -> Producto:
        if nuevo_precio <= 0:
            msg = "El precio debe ser mayor a 0."
            raise ValueError(msg)
        producto.precio = nuevo_precio
        producto.save(update_fields=["precio"])
        return producto


class FotoProductoService:
    """Galería de un producto: la portada (``Producto.imagen``) más las fotos
    adicionales (``ProductoImagen``). Los archivos no se copian: cambiar la
    portada solo intercambia qué registro apunta a cada archivo."""

    @staticmethod
    def total(producto: Producto) -> int:
        return producto.fotos.count() + (1 if producto.imagen else 0)

    @staticmethod
    def _foto(producto: Producto, foto_id: int) -> ProductoImagen:
        try:
            return producto.fotos.get(pk=foto_id)
        except ProductoImagen.DoesNotExist:
            msg = "La foto no existe o no es de este producto."
            raise ValueError(msg) from None

    @staticmethod
    @transaction.atomic
    def agregar(producto: Producto, imagen) -> Producto:
        """Si el producto no tiene portada, la foto pasa a serlo."""
        if FotoProductoService.total(producto) >= MAX_FOTOS_POR_PRODUCTO:
            msg = f"Cada producto admite hasta {MAX_FOTOS_POR_PRODUCTO} fotos."
            raise ValueError(msg)
        if not producto.imagen:
            producto.imagen = imagen
            producto.save(update_fields=["imagen"])
            return producto
        ultimo = producto.fotos.aggregate(m=Max("orden"))["m"]
        ProductoImagen.objects.create(
            producto=producto,
            imagen=imagen,
            orden=0 if ultimo is None else ultimo + 1,
        )
        return producto

    @staticmethod
    def eliminar(producto: Producto, foto_id: int) -> Producto:
        FotoProductoService._foto(producto, foto_id).delete()
        return producto

    @staticmethod
    @transaction.atomic
    def ordenar(producto: Producto, ids: list[int]) -> Producto:
        """Recibe los ids de TODAS las fotos adicionales en el orden nuevo."""
        fotos = {f.pk: f for f in producto.fotos.all()}
        if len(ids) != len(set(ids)) or set(ids) != set(fotos):
            msg = "El orden debe incluir cada foto del producto una sola vez."
            raise ValueError(msg)
        for posicion, foto_id in enumerate(ids):
            fotos[foto_id].orden = posicion
        ProductoImagen.objects.bulk_update(fotos.values(), ["orden"])
        return producto

    @staticmethod
    @transaction.atomic
    def hacer_portada(producto: Producto, foto_id: int) -> Producto:
        """La foto elegida pasa a portada y la portada anterior queda en su
        lugar de la galería."""
        foto = FotoProductoService._foto(producto, foto_id)
        portada_anterior = producto.imagen.name if producto.imagen else ""
        producto.imagen.name = foto.imagen.name
        producto.save(update_fields=["imagen"])
        if portada_anterior:
            foto.imagen.name = portada_anterior
            foto.save(update_fields=["imagen"])
        else:
            foto.delete()
        return producto

    @staticmethod
    @transaction.atomic
    def quitar_portada(producto: Producto) -> Producto:
        """Quita la portada; si hay más fotos, la primera ocupa su lugar."""
        if not producto.imagen:
            msg = "El producto no tiene portada."
            raise ValueError(msg)
        siguiente = producto.fotos.first()
        if siguiente:
            producto.imagen.name = siguiente.imagen.name
            siguiente.delete()
        else:
            producto.imagen = None
        producto.save(update_fields=["imagen"])
        return producto


class PromocionService:
    @staticmethod
    def crear(  # noqa: PLR0913 -- un parámetro por campo de la promoción
        nombre: str,
        precio: Decimal,
        fecha_inicio,
        fecha_fin,
        descripcion: str = "",
        imagen=None,
    ) -> Promocion:
        if precio <= 0:
            msg = "El precio debe ser mayor a 0."
            raise ValueError(msg)
        if fecha_inicio < timezone.localdate():
            msg = "No se pueden crear promociones con fecha de inicio en el pasado."
            raise ValueError(msg)
        if fecha_fin < fecha_inicio:
            msg = "La fecha de fin no puede ser anterior a la de inicio."
            raise ValueError(msg)
        return Promocion.objects.create(
            nombre=nombre,
            precio=precio,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin,
            descripcion=descripcion,
            imagen=imagen,
        )

    @staticmethod
    def editar(promocion: Promocion, **kwargs) -> Promocion:
        precio = kwargs.get("precio")
        if precio is not None and precio <= 0:
            msg = "El precio debe ser mayor a 0."
            raise ValueError(msg)
        fecha_inicio = kwargs.get("fecha_inicio", promocion.fecha_inicio)
        fecha_fin = kwargs.get("fecha_fin", promocion.fecha_fin)
        if fecha_fin < fecha_inicio:
            msg = "La fecha de fin no puede ser anterior a la de inicio."
            raise ValueError(msg)
        for campo, valor in kwargs.items():
            if valor is not None:
                setattr(promocion, campo, valor)
        promocion.save()
        return promocion

    @staticmethod
    def activar(promocion: Promocion) -> Promocion:
        promocion.activo = True
        promocion.save(update_fields=["activo"])
        return promocion

    @staticmethod
    def desactivar(promocion: Promocion) -> Promocion:
        promocion.activo = False
        promocion.save(update_fields=["activo"])
        return promocion
