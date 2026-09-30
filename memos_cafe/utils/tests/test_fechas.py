from datetime import date
from datetime import datetime
from datetime import timedelta
from zoneinfo import ZoneInfo

from memos_cafe.utils.fechas import entre_fechas
from memos_cafe.utils.fechas import inicio_del_dia

LIMA = ZoneInfo("America/Lima")
UTC = ZoneInfo("UTC")


def test_inicio_del_dia_es_medianoche_en_lima():
    inicio = inicio_del_dia(date(2026, 9, 30))
    assert inicio == datetime(2026, 9, 30, tzinfo=LIMA)
    # Lima es UTC-5: la medianoche local son las 05:00 UTC
    assert inicio.astimezone(UTC) == datetime(2026, 9, 30, 5, tzinfo=UTC)


def test_entre_fechas_un_solo_dia():
    filtro = entre_fechas("fecha", date(2026, 9, 30))
    assert filtro == {
        "fecha__gte": datetime(2026, 9, 30, tzinfo=LIMA),
        "fecha__lt": datetime(2026, 10, 1, tzinfo=LIMA),
    }


def test_entre_fechas_rango_incluye_el_ultimo_dia_completo():
    filtro = entre_fechas("orden__fecha_cierre", date(2026, 9, 1), date(2026, 9, 30))
    assert filtro["orden__fecha_cierre__gte"] == datetime(2026, 9, 1, tzinfo=LIMA)
    assert filtro["orden__fecha_cierre__lt"] - timedelta(days=1) == datetime(
        2026,
        9,
        30,
        tzinfo=LIMA,
    )
