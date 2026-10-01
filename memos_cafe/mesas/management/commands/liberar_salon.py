from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from memos_cafe.caja.models import SolicitudCobro
from memos_cafe.mesas.models import Mesa
from memos_cafe.mesas.models import PedidoPorConfirmar
from memos_cafe.mesas.models import SesionMesaQR
from memos_cafe.ordenes.models import Orden
from memos_cafe.ordenes.services import OrdenService


class Command(BaseCommand):
    """Deja el salón limpio después de hacer pruebas: anula los pedidos
    abiertos (no se borran: quedan como "Anulada" en el historial), da por
    atendidos los "pidió la cuenta", descarta los pedidos por QR sin
    confirmar y libera todas las mesas.

    Sin --confirmar solo muestra lo que haría. No toca pagos, turnos de
    caja ni pedidos ya cobrados."""

    help = "Anula los pedidos abiertos y libera todas las mesas (para pruebas)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirmar",
            action="store_true",
            help="Aplica los cambios. Sin esto solo muestra lo que haría.",
        )

    def handle(self, *args, **options):
        abiertas = Orden.objects.filter(estado=Orden.Estado.ABIERTA).select_related(
            "mesa",
        )
        cuentas = SolicitudCobro.objects.filter(atendido_en__isnull=True)
        por_confirmar = PedidoPorConfirmar.objects.filter(
            estado=PedidoPorConfirmar.Estado.PENDIENTE,
        )
        sesiones = SesionMesaQR.objects.filter(cerrada_en__isnull=True)
        mesas = Mesa.objects.exclude(estado=Mesa.Estado.LIBRE)

        for orden in abiertas:
            donde = f"mesa {orden.mesa.numero}" if orden.mesa else orden.tipo_orden
            self.stdout.write(f"  Pedido #{orden.id} ({donde}) S/ {orden.total}")
        self.stdout.write(
            f"Pedidos abiertos: {abiertas.count()} · cuentas pedidas: "
            f"{cuentas.count()} · pedidos QR sin confirmar: "
            f"{por_confirmar.count()} · mesas no libres: {mesas.count()}",
        )

        if not options["confirmar"]:
            self.stdout.write(
                self.style.WARNING(
                    "No se cambió nada. Agrega --confirmar para aplicarlo.",
                ),
            )
            return

        ahora = timezone.now()
        with transaction.atomic():
            for orden in abiertas:
                OrdenService.anular_orden(orden)
            cuentas.update(atendido_en=ahora)
            por_confirmar.update(
                estado=PedidoPorConfirmar.Estado.EXPIRADO,
                resuelto_en=ahora,
            )
            sesiones.update(cerrada_en=ahora)
            mesas.update(estado=Mesa.Estado.LIBRE)
        self.stdout.write(self.style.SUCCESS("Listo: todas las mesas están libres."))
