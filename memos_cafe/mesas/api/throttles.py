from rest_framework.throttling import AnonRateThrottle


class _PorMesaThrottle(AnonRateThrottle):
    """Limita por MESA, no por IP del cliente. El wifi de una cafeteria
    tipicamente pone a todos los clientes conectados detras de la misma
    IP publica (NAT) -- un throttle por IP compartiria el mismo balde
    entre mesas distintas y podria agotarse rapido en horario pico sin
    que ninguna mesa individual este abusando. Cada mesa tiene su propio
    balde, sin importar cuantos dispositivos haya detras del mismo
    router. Si por algun motivo no hay mesa_id en la URL, cae al
    comportamiento normal por IP de AnonRateThrottle."""

    def get_cache_key(self, request, view):
        mesa_id = view.kwargs.get("mesa_id")
        if mesa_id is None:
            return super().get_cache_key(request, view)
        return f"throttle_{self.scope}_mesa_{mesa_id}"


class PedidoQRThrottle(_PorMesaThrottle):
    """Endpoint publico (sin login): un cliente agregando items o
    consultando el estado de su mesa."""
    rate = "20/minute"
    scope = "pedido_qr"


class SolicitarCobroThrottle(_PorMesaThrottle):
    """Accion mas rara (una vez por mesa al terminar), rate mas bajo que
    el de agregar items."""
    rate = "5/minute"
    scope = "solicitar_cobro"
