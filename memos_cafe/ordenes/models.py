from auditlog.registry import auditlog
from django.conf import settings
from django.db import models
from django.db.models import Sum
from django.utils import timezone

from memos_cafe.mesas.models import Mesa
from memos_cafe.ordenes.managers import OrdenManager
from memos_cafe.productos.models import Producto
from memos_cafe.productos.models import Promocion


class Orden(models.Model):
    class Estado(models.TextChoices):
        ABIERTA = "abierta", "Abierta"
        CERRADA = "cerrada", "Cerrada"
        ANULADA = "anulada", "Anulada"

    class TipoOrden(models.TextChoices):
        MESA = "mesa", "Mesa"
        LLEVAR = "llevar", "Para llevar"
        DELIVERY = "delivery", "Delivery"

    class PlataformaDelivery(models.TextChoices):
        RAPPI = "rappi", "Rappi"
        PEDIDOS_YA = "pedidos_ya", "PedidosYa"
        DIDI = "didi", "DiDi Food"
        OTRO = "otro", "Otro"

    mesa = models.ForeignKey(
        Mesa,
        on_delete=models.PROTECT,
        related_name="ordenes",
        null=True,
        blank=True,
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="ordenes",
    )
    estado = models.CharField(
        max_length=10,
        choices=Estado.choices,
        default=Estado.ABIERTA,
    )
    tipo_orden = models.CharField(
        max_length=10,
        choices=TipoOrden.choices,
        default=TipoOrden.MESA,
    )
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_cierre = models.DateTimeField(null=True, blank=True)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # --- Campos delivery ---
    cliente_nombre = models.CharField(max_length=150, blank=True)
    cliente_telefono = models.CharField(max_length=20, blank=True)
    direccion_entrega = models.CharField(max_length=255, blank=True)
    plataforma_delivery = models.CharField(
        max_length=15,
        choices=PlataformaDelivery.choices,
        blank=True,
    )
    plataforma_otra = models.CharField(max_length=100, blank=True)

    objects = OrdenManager()

    class Meta:
        db_table = "orden"
        verbose_name = "Orden"
        verbose_name_plural = "Órdenes"
        ordering = ["-fecha_creacion"]
        indexes = [
            # Listado de ordenes del dia/turno y reportes por rango de fechas
            # (ver memos_cafe.utils.fechas.entre_fechas).
            models.Index(fields=["fecha_creacion"], name="orden_fecha_creacion_idx"),
            # Reportes de productos vendidos: filtran por fecha de cierre.
            models.Index(fields=["fecha_cierre"], name="orden_fecha_cierre_idx"),
            # Indice parcial: solo las ordenes por cobrar, que son pocas.
            # Resuelve ?estado=abierta (polling de Caja), el conteo del
            # dashboard y la validacion al cerrar caja sin recorrer el
            # historial completo.
            models.Index(
                fields=["fecha_creacion"],
                condition=models.Q(estado="abierta"),
                name="orden_abiertas_idx",
            ),
        ]

    def __str__(self):
        return f"Orden #{self.id} - {self.tipo_orden} ({self.estado})"

    # --- Comportamiento del objeto ---

    def recalcular_total(self):
        resultado = self.detalles.aggregate(suma=Sum("subtotal"))
        self.total = resultado["suma"] or 0
        self.save(update_fields=["total"])

    def cerrar(self):
        """Cierra la orden y libera la mesa si aplica."""
        if self.estado != self.Estado.ABIERTA:
            msg = "Solo se pueden cerrar órdenes abiertas."
            raise ValueError(msg)
        self.estado = self.Estado.CERRADA
        self.fecha_cierre = timezone.now()
        self.save(update_fields=["estado", "fecha_cierre"])
        if self.mesa_id:
            self.mesa.liberar()

    def reabrir(self):
        """Reabre una orden cerrada (ej. cuando se anula el pago que la cerró).
        Reocupa la mesa solo si sigue libre; si otra orden ya la tomó,
        la orden vuelve a 'abierta' sin mesa asignada para que el
        cajero/mesero la reasigne manualmente."""
        if self.estado != self.Estado.CERRADA:
            msg = "Solo se pueden reabrir órdenes cerradas."
            raise ValueError(msg)
        self.estado = self.Estado.ABIERTA
        self.fecha_cierre = None
        self.save(update_fields=["estado", "fecha_cierre"])
        if self.mesa_id and self.mesa.estado == Mesa.Estado.LIBRE:
            self.mesa.ocupar()

    def anular(self):
        if self.estado == self.Estado.ANULADA:
            msg = "Esta orden ya está anulada."
            raise ValueError(msg)
        # Guardar antes del save — después self.estado ya cambió
        estaba_abierta = self.estado == self.Estado.ABIERTA
        self.estado = self.Estado.ANULADA
        self.fecha_cierre = timezone.now()
        self.save(update_fields=["estado", "fecha_cierre"])
        if self.mesa_id and estaba_abierta:
            self.mesa.liberar()

    @property
    def esta_abierta(self):
        return self.estado == self.Estado.ABIERTA


class DetalleOrden(models.Model):
    orden = models.ForeignKey(Orden, on_delete=models.CASCADE, related_name="detalles")
    producto = models.ForeignKey(
        Producto,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="detalles_orden",
    )
    promocion = models.ForeignKey(
        Promocion,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="detalles_orden",
    )
    cantidad = models.SmallIntegerField()
    precio_unitario = models.DecimalField(max_digits=10, decimal_places=2)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    nota = models.CharField(max_length=150, blank=True)
    impreso = models.BooleanField(default=False)

    class Meta:
        db_table = "detalle_orden"
        verbose_name = "Detalle de orden"
        verbose_name_plural = "Detalles de orden"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(producto__isnull=False) | models.Q(promocion__isnull=False)
                ),
                name="chk_detalle_al_menos_un_item",
            ),
        ]

    def __str__(self):
        partes = []
        if self.producto:
            partes.append(str(self.producto))
        if self.promocion:
            partes.append(str(self.promocion))
        return f"{self.cantidad}x {' + '.join(partes)} — Orden #{self.orden_id}"

    def save(self, *args, **kwargs):
        self.subtotal = self.precio_unitario * self.cantidad
        super().save(*args, **kwargs)


auditlog.register(Orden)
