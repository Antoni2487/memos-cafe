"""Consumers de WebSocket — solo transporte.

Cero logica de negocio aca (ni llamadas de escritura a services.py): el
criterio de aceptacion del pedido por QR pide explicitamente que toda la
logica nueva pase por la capa de servicios, nunca por los consumers. Estos
consumers solo validan el rol para unirse al grupo del channel layer
correcto y relayan al cliente los eventos que
DetalleOrdenService._notificar_cambio_estado() ya decidio disparar.
"""

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer


class _StaffConsumer(AsyncJsonWebsocketConsumer):
    grupo_channel_layer: str = ""
    roles_permitidos: list[str] = []

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close(code=4401)
            return
        if not await self._tiene_rol(user):
            await self.close(code=4403)
            return
        await self.channel_layer.group_add(self.grupo_channel_layer, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if self.channel_layer:
            await self.channel_layer.group_discard(
                self.grupo_channel_layer,
                self.channel_name,
            )

    @database_sync_to_async
    def _tiene_rol(self, user):
        # admin siempre pasa, mismo criterio que utils/permissions.py
        return user.groups.filter(name__in=["admin", *self.roles_permitidos]).exists()

    async def detalle_actualizado(self, event):
        """Handler del evento type='detalle.actualizado' (Channels
        convierte el punto a guion bajo para resolver el nombre del
        metodo). event ya trae el payload armado por el service."""
        await self.send_json(event)

    async def pedido_nuevo(self, event):
        """Handler del evento type='pedido.nuevo' — items nuevos por
        preparar (orden creada o ronda agregada). Solo llega al grupo
        'cocina', ver OrdenService._notificar_nuevo_pedido."""
        await self.send_json(event)

    async def solicitud_cobro_nueva(self, event):
        """Handler del evento type='solicitud_cobro.nueva' — el cliente
        pidio la cuenta por QR. Llega al grupo 'meseros', que ahora tambien
        escuchan los cajeros: quien cobra depende del metodo de pago (el
        cliente se acerca a caja, o el mesero le lleva el POS a la mesa)."""
        await self.send_json(event)

    async def comanda_actualizada(self, event):
        """type='comanda.actualizada' — una comanda cambio de estado
        (empezada, lista, entregada) o se le sumo un item. Lo reciben
        Cocina y, cuando queda lista, los meseros."""
        await self.send_json(event)

    async def pedido_por_confirmar(self, event):
        """type='pedido.por_confirmar' — primer pedido por QR de una mesa
        libre: un mesero tiene que confirmarlo o rechazarlo."""
        await self.send_json(event)

    async def pedido_por_confirmar_resuelto(self, event):
        """type='pedido.por_confirmar_resuelto' — otro mesero ya lo
        confirmo o rechazo: el aviso se quita de todas las pantallas."""
        await self.send_json(event)


class CocinaConsumer(_StaffConsumer):
    grupo_channel_layer = "cocina"
    roles_permitidos = ["cocina"]


class MeseroConsumer(_StaffConsumer):
    grupo_channel_layer = "meseros"
    roles_permitidos = ["mesero", "cajero"]
