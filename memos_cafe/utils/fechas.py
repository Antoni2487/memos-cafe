"""Filtros por rango de fechas que PostgreSQL puede resolver con indices.

Con USE_TZ=True, un lookup como `fecha__date=hoy` se traduce a
`(fecha AT TIME ZONE 'America/Lima')::date = hoy`: una expresion sobre la
columna, que ningun indice sobre `fecha` puede aprovechar, asi que cada
consulta recorre la tabla completa. `entre_fechas()` expresa lo mismo
como un rango sobre la columna cruda (`fecha >= inicio AND fecha < fin`),
con los limites calculados en la zona horaria local.
"""

from datetime import date
from datetime import datetime
from datetime import time
from datetime import timedelta

from django.utils import timezone


def inicio_del_dia(dia: date) -> datetime:
    """00:00 del dia en la zona horaria local, como datetime aware."""
    return timezone.make_aware(datetime.combine(dia, time.min))


def entre_fechas(campo: str, desde: date, hasta: date | None = None) -> dict:
    """kwargs de filtro equivalentes a `campo__date__gte=desde,
    campo__date__lte=hasta` (o `campo__date=desde` si no hay `hasta`).

    Uso: Pago.objects.filter(estado="completado", **entre_fechas("fecha", hoy))
    """
    hasta = hasta or desde
    return {
        f"{campo}__gte": inicio_del_dia(desde),
        f"{campo}__lt": inicio_del_dia(hasta + timedelta(days=1)),
    }
