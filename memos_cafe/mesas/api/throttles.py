"""Limites de los endpoints publicos del pedido por QR.

Cada vista lleva dos throttles:

- por dispositivo: el celular manda un id aleatorio propio en el header
  X-Dispositivo-QR (lo genera y guarda el frontend). Sin ese header se
  usa la IP. Evita que un solo celular sature la mesa.
- por mesa: un tope general mas alto para toda la mesa.

Antes habia un unico balde por mesa, y una mesa de 4 personas lo agotaba
sola: cada celular consulta el estado cada 10 s (6/min) y el limite era
20/min para toda la mesa, compartido ademas con el envio del pedido.

El id de dispositivo lo inventa el cliente, asi que no es seguridad: quien
lo cambie en cada request solo consigue topar con el limite por mesa. La
proteccion real es el codigo secreto de la URL (ver Mesa.codigo_qr). Los
limites viven en REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"].
"""

import uuid

from rest_framework.throttling import SimpleRateThrottle

HEADER_DISPOSITIVO = "HTTP_X_DISPOSITIVO_QR"


def _id_dispositivo(request):
    valor = request.META.get(HEADER_DISPOSITIVO, "")
    try:
        return str(uuid.UUID(valor))
    except ValueError:
        return None


class _QRThrottle(SimpleRateThrottle):
    por_dispositivo = True

    def get_cache_key(self, request, view):
        codigo = view.kwargs.get("codigo", "")
        if not self.por_dispositivo:
            return f"throttle_{self.scope}_{codigo}"
        dispositivo = _id_dispositivo(request) or f"ip-{self.get_ident(request)}"
        return f"throttle_{self.scope}_{codigo}_{dispositivo}"


class QRLecturaDispositivoThrottle(_QRThrottle):
    """GET del estado de la mesa (el frontend lo consulta cada 10 s)."""

    scope = "qr_lectura_dispositivo"


class QRLecturaMesaThrottle(_QRThrottle):
    scope = "qr_lectura_mesa"
    por_dispositivo = False


class QRPedidoDispositivoThrottle(_QRThrottle):
    """POST de un pedido o una ronda nueva."""

    scope = "qr_pedido_dispositivo"


class QRPedidoMesaThrottle(_QRThrottle):
    scope = "qr_pedido_mesa"
    por_dispositivo = False


class QRCobroDispositivoThrottle(_QRThrottle):
    """POST de "pedir la cuenta": accion rara, una vez al terminar."""

    scope = "qr_cobro_dispositivo"


class QRCobroMesaThrottle(_QRThrottle):
    scope = "qr_cobro_mesa"
    por_dispositivo = False


LECTURA = [QRLecturaDispositivoThrottle, QRLecturaMesaThrottle]
PEDIDO = [QRPedidoDispositivoThrottle, QRPedidoMesaThrottle]
COBRO = [QRCobroDispositivoThrottle, QRCobroMesaThrottle]
