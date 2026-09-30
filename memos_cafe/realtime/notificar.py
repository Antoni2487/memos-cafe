"""Avisos en tiempo real al personal (Cocina, meseros) via Channels.

Toda notificacion pasa por aca por dos motivos:

1. Se envia recien cuando la transaccion confirma (transaction.on_commit).
   Enviarla antes provocaba una carrera: Cocina recibia el aviso, recargaba
   el tablero y todavia no veia el pedido, que seguia sin confirmar.
2. Un fallo del channel layer (Redis caido o inalcanzable) nunca debe
   hacer fallar la operacion real. Antes el error salia dentro de la
   transaccion de crear_orden y deshacia la orden: sin Redis no se podia
   crear ninguna orden, ni siquiera las normales del mesero. Ahora se
   registra en el log y listo; el tablero de Cocina igual se entera en su
   refresco periodico.
"""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

logger = logging.getLogger("memos_cafe.realtime")


def _enviar(grupos, evento):
    channel_layer = get_channel_layer()
    if channel_layer is None:  # Channels sin configurar
        return
    for grupo in grupos:
        try:
            async_to_sync(channel_layer.group_send)(grupo, evento)
        except Exception:
            logger.exception(
                "No se pudo notificar %s al grupo %s",
                evento.get("type"),
                grupo,
            )


def notificar(grupos: list[str], evento: dict) -> None:
    """Encola `evento` para los `grupos` indicados; se envia al confirmar
    la transaccion actual (o de inmediato si no hay una abierta)."""
    transaction.on_commit(lambda: _enviar(grupos, evento))
