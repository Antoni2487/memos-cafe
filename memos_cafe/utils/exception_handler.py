import logging

from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler

logger = logging.getLogger("django.request")


def custom_exception_handler(exc, context):
    """EXCEPTION_HANDLER de DRF (ver REST_FRAMEWORK en settings).

    El handler por defecto de DRF solo convierte APIException/Http404/
    PermissionDenied a JSON -- cualquier otra excepcion (IntegrityError,
    AttributeError, un ValidationError de Django escapando de un filtro de
    queryset, etc.) queda sin manejar y cae al handler HTML generico de
    Django, devolviendole al frontend una pagina de error en vez del JSON
    que espera. Este wrapper cubre ese hueco: delega al handler de DRF, y
    si no supo que hacer con la excepcion, la loguea con traceback y
    devuelve un 500 en el mismo formato {"detail": ...} que ya usa el
    resto de la API. DEBUG=False en produccion evita que el mensaje real
    de la excepcion se filtre al cliente."""
    response = drf_exception_handler(exc, context)
    if response is not None:
        return response

    request = context.get("request")
    logger.error(
        "Excepcion no controlada en %s | usuario=%s",
        getattr(request, "path", "?"),
        getattr(getattr(request, "user", None), "email", "anonimo"),
        exc_info=exc,
    )
    return Response({"detail": "Ha ocurrido un error interno."}, status=500)
