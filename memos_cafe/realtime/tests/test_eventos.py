"""Cada evento en tiempo real que mandan los servicios necesita su handler
en el consumer: Channels no ignora un tipo desconocido, corta la conexión
del celular (y ese mesero deja de recibir avisos hasta reconectar)."""

import re
from pathlib import Path

from memos_cafe.realtime.consumers import _StaffConsumer

RAIZ = Path(__file__).resolve().parents[2]
TIPO = re.compile(r'"([a-z]+(?:_[a-z]+)*\.[a-z]+(?:_[a-z]+)*)"')


def _tipos_enviados() -> set[str]:
    tipos = set()
    for archivo in RAIZ.rglob("services.py"):
        fuente = archivo.read_text(encoding="utf-8")
        if "notificar(" in fuente:
            tipos |= {
                t for t in TIPO.findall(fuente) if not t.startswith("memos_cafe.")
            }
    return tipos


def test_se_encuentran_los_eventos():
    assert {
        "pedido.nuevo",
        "comanda.actualizada",
        "pedido.ronda_qr",
    } <= _tipos_enviados()


def test_cada_evento_tiene_su_handler():
    sin_handler = sorted(
        tipo
        for tipo in _tipos_enviados()
        if not hasattr(_StaffConsumer, tipo.replace(".", "_"))
    )
    assert sin_handler == []
