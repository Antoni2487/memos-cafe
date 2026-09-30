import secrets
import uuid

from auditlog.registry import auditlog
from django.conf import settings
from django.db import models
from django.utils import timezone


def generar_codigo_qr() -> str:
    """Codigo aleatorio de 12 caracteres (72 bits) para la URL publica del
    QR de una mesa. Reemplaza al id correlativo (1, 2, 3...), que permitia
    pedir a cualquier mesa desde fuera del local probando numeros."""
    return secrets.token_urlsafe(9)


class Mesa(models.Model):
    class Estado(models.TextChoices):
        LIBRE = "libre", "Libre"
        OCUPADA = "ocupada", "Ocupada"
        RESERVADA = "reservada", "Reservada"

    numero = models.SmallIntegerField(unique=True)
    capacidad = models.SmallIntegerField()
    estado = models.CharField(
        max_length=10,
        choices=Estado.choices,
        default=Estado.LIBRE,
    )
    activo = models.BooleanField(default=True)
    fecha_baja = models.DateTimeField(null=True, blank=True)
    # Lo que codifica el QR impreso (/pedir/<codigo_qr>). Es secreto: solo
    # lo ve el personal. Si se filtra, el admin lo regenera y reimprime
    # (ver MesaService.regenerar_codigo_qr).
    codigo_qr = models.CharField(
        max_length=16,
        unique=True,
        default=generar_codigo_qr,
        editable=False,
    )

    class Meta:
        db_table = "mesa"
        verbose_name = "Mesa"
        verbose_name_plural = "Mesas"
        ordering = ["numero"]

    def __str__(self):
        return f"Mesa {self.numero} ({self.estado})"

    # --- Lógica de negocio ---

    def ocupar(self):
        """El mesero abre una orden → la mesa pasa a ocupada.
        Puede ocuparse tanto una mesa libre como una reservada
        (el cliente de la reserva llega y se le crea la orden)."""
        if self.estado not in (self.Estado.LIBRE, self.Estado.RESERVADA):
            msg = f"La mesa {self.numero} no está disponible para ocupar."
            raise ValueError(msg)
        self.estado = self.Estado.OCUPADA
        self.save(update_fields=["estado"])

    def liberar(self):
        """El cajero cobra la orden (o se anula) → la mesa vuelve a libre.
        Siempre automático, nunca manual.

        Punto único de enganche: cierra tambien cualquier sesion de pedido
        por QR activa de esta mesa. Orden.cerrar() y Orden.anular() ya
        llaman a este metodo, asi que ambos caminos invalidan la sesion
        sin que ordenes/services.py necesite saber que SesionMesaQR existe.
        """
        self.estado = self.Estado.LIBRE
        self.save(update_fields=["estado"])
        SesionMesaQR.objects.filter(mesa=self, cerrada_en__isnull=True).update(
            cerrada_en=timezone.now(),
        )

    def dar_de_baja(self):
        """El admin desactiva una mesa (ej: mantenimiento)."""
        self.activo = False
        self.estado = self.Estado.LIBRE
        self.fecha_baja = timezone.now()
        self.save(update_fields=["activo", "estado", "fecha_baja"])


class SesionMesaQR(models.Model):
    """Sesion de pedido por QR de una mesa. El QR impreso solo codifica el
    numero de mesa (nunca se reimprime); esta sesion es el token real que
    el frontend cliente guarda tras escanear, y se invalida sola cuando la
    mesa vuelve a libre (ver Mesa.liberar()). El mesero que la abre queda
    registrado como el usuario que atribuye la venta — no hace falta que
    Orden.usuario sea nullable para pedidos originados por QR."""

    mesa = models.ForeignKey(
        Mesa,
        on_delete=models.PROTECT,
        related_name="sesiones_qr",
    )
    mesero = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="sesiones_mesa_abiertas",
    )
    token = models.UUIDField(unique=True, default=uuid.uuid4, editable=False)
    abierta_en = models.DateTimeField(auto_now_add=True)
    cerrada_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "sesion_mesa_qr"
        verbose_name = "Sesión de mesa (QR)"
        verbose_name_plural = "Sesiones de mesa (QR)"
        ordering = ["-abierta_en"]
        constraints = [
            models.UniqueConstraint(
                fields=["mesa"],
                condition=models.Q(cerrada_en__isnull=True),
                name="una_sesion_activa_por_mesa",
            ),
        ]

    def __str__(self):
        estado = "activa" if self.cerrada_en is None else "cerrada"
        return f"Sesión QR Mesa {self.mesa.numero} ({estado})"

    @property
    def esta_activa(self):
        return self.cerrada_en is None


auditlog.register(Mesa)
auditlog.register(SesionMesaQR)
