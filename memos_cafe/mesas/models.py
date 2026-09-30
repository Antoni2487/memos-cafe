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


# Croquis del salon: un lienzo de PLANO_ANCHO x PLANO_ALTO unidades. El
# frontend lo escala al ancho de la pantalla manteniendo la proporcion, asi
# el mismo plano se ve igual en una tablet y en un celular.
PLANO_ANCHO = 1000
PLANO_ALTO = 640


class Forma(models.TextChoices):
    REDONDA = "redonda", "Redonda"
    RECTANGULAR = "rectangular", "Rectangular"


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
    # Posicion en el croquis (centro de la mesa). Sin posicion, la mesa
    # todavia no se ubico: el editor la muestra aparte para arrastrarla.
    plano_x = models.PositiveSmallIntegerField(null=True, blank=True)
    plano_y = models.PositiveSmallIntegerField(null=True, blank=True)
    plano_ancho = models.PositiveSmallIntegerField(default=70)
    plano_alto = models.PositiveSmallIntegerField(default=70)
    forma = models.CharField(max_length=12, choices=Forma, default=Forma.REDONDA)
    rotacion = models.PositiveSmallIntegerField(default=0)

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


class ElementoPlano(models.Model):
    """Lo que no es una mesa en el croquis: la barra, una pared o divisor,
    la entrada o un texto. Solo orienta al mesero; no tiene estado."""

    class Tipo(models.TextChoices):
        BARRA = "barra", "Barra"
        PARED = "pared", "Pared o divisor"
        ENTRADA = "entrada", "Entrada"
        TEXTO = "texto", "Texto"

    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    etiqueta = models.CharField(max_length=40, blank=True)
    plano_x = models.PositiveSmallIntegerField()
    plano_y = models.PositiveSmallIntegerField()
    plano_ancho = models.PositiveSmallIntegerField()
    plano_alto = models.PositiveSmallIntegerField()
    forma = models.CharField(
        max_length=12,
        choices=Forma,
        default=Forma.RECTANGULAR,
    )
    rotacion = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "elemento_plano"
        verbose_name = "Elemento del plano"
        verbose_name_plural = "Elementos del plano"
        ordering = ["id"]

    def __str__(self):
        return self.etiqueta or self.get_tipo_display()


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


class PedidoPorConfirmar(models.Model):
    """Primer pedido por QR de una mesa que estaba libre. Espera a que un
    mesero lo confirme (hay gente sentada) o lo rechace (la mesa esta vacia:
    alguien pidio con una foto del QR). Recien al confirmarlo se crea la
    Orden, asi que Cocina y Caja no ven nada que no este confirmado.

    Si varios celulares de la mesa piden mientras tanto, sus items se suman
    a este mismo pedido. Ver SesionMesaService en mesas/services.py."""

    class Estado(models.TextChoices):
        PENDIENTE = "pendiente", "Por confirmar"
        CONFIRMADO = "confirmado", "Confirmado"
        RECHAZADO = "rechazado", "Rechazado"
        EXPIRADO = "expirado", "Expirado"

    mesa = models.ForeignKey(
        Mesa,
        on_delete=models.CASCADE,
        related_name="pedidos_por_confirmar",
    )
    # [{"producto": id|null, "promocion": id|null, "cantidad": n, "nota": "",
    #   "nombre": "...", "precio": "10.00"}] -- nombre y precio para mostrar
    items = models.JSONField(default=list)
    estado = models.CharField(
        max_length=12,
        choices=Estado.choices,
        default=Estado.PENDIENTE,
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)
    resuelto_en = models.DateTimeField(null=True, blank=True)
    resuelto_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pedidos_qr_resueltos",
    )
    # Orden creada al confirmar. String para no importar ordenes.models
    # (que ya importa Mesa de aca).
    orden = models.ForeignKey(
        "ordenes.Orden",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        db_table = "pedido_por_confirmar"
        verbose_name = "Pedido por confirmar (QR)"
        verbose_name_plural = "Pedidos por confirmar (QR)"
        ordering = ["creado_en"]
        constraints = [
            models.UniqueConstraint(
                fields=["mesa"],
                condition=models.Q(estado="pendiente"),
                name="un_pedido_por_confirmar_por_mesa",
            ),
        ]

    def __str__(self):
        return f"Pedido por confirmar Mesa {self.mesa.numero} ({self.estado})"


auditlog.register(Mesa)
auditlog.register(SesionMesaQR)
auditlog.register(PedidoPorConfirmar)
auditlog.register(ElementoPlano)
