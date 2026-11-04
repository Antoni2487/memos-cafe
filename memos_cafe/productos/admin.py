from django.contrib import admin

from memos_cafe.productos.models import Categoria
from memos_cafe.productos.models import Producto
from memos_cafe.productos.models import ProductoImagen
from memos_cafe.productos.models import Promocion


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ["nombre", "activo", "total_productos"]
    list_filter = ["activo"]
    search_fields = ["nombre"]

    @admin.display(description="Productos")
    def total_productos(self, obj):
        return obj.productos.count()


class ProductoImagenInline(admin.TabularInline):
    model = ProductoImagen
    extra = 0
    fields = ["imagen", "orden"]


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    inlines = [ProductoImagenInline]
    list_display = ["nombre", "categoria", "precio", "disponible"]
    list_filter = ["disponible", "categoria"]
    search_fields = ["nombre", "descripcion"]
    ordering = ["categoria", "nombre"]
    list_select_related = ["categoria"]

    actions = ["activar", "desactivar"]

    @admin.action(description="Activar productos seleccionados")
    def activar(self, request, queryset):
        queryset.update(disponible=True)

    @admin.action(description="Desactivar productos seleccionados")
    def desactivar(self, request, queryset):
        queryset.update(disponible=False)


@admin.register(Promocion)
class PromocionAdmin(admin.ModelAdmin):
    list_display = [
        "nombre",
        "precio",
        "activo",
        "fecha_inicio",
        "fecha_fin",
        "vigente",
    ]
    list_filter = ["activo"]
    search_fields = ["nombre", "descripcion"]
    ordering = ["fecha_fin"]

    @admin.display(description="Vigente", boolean=True)
    def vigente(self, obj):
        return obj.esta_vigente()
