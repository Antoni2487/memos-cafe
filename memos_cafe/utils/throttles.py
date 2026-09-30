from rest_framework.throttling import AnonRateThrottle


class CatalogoPublicoThrottle(AnonRateThrottle):
    """Carta publica del pedido por QR (productos y promociones). Es por IP
    como el throttle anonimo general (20/min), pero con un limite propio mas
    alto: en el wifi del local todos los clientes salen con la misma IP
    publica, y con 20/min unas diez mesas cargando la carta a la vez ya
    recibian 429. Limite en DEFAULT_THROTTLE_RATES["qr_catalogo"]."""

    scope = "qr_catalogo"
