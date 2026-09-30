import pytest
from channels.layers import channel_layers
from django.test import override_settings
from rest_framework.test import APIClient

from memos_cafe.realtime.notificar import estado_tiempo_real

REDIS_CAIDO = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": ["redis://:clave-secreta@127.0.0.1:1/0"]},
    },
}


@pytest.fixture(autouse=True)
def _channel_layers_limpios():
    channel_layers.backends.clear()
    yield
    channel_layers.backends.clear()


def test_estado_ok_con_channel_layer_disponible():
    assert estado_tiempo_real() == {"estado": "ok", "backend": "InMemoryChannelLayer"}


@override_settings(CHANNEL_LAYERS=REDIS_CAIDO)
def test_estado_error_con_redis_caido_sin_revelar_detalles():
    estado = estado_tiempo_real()

    assert estado["estado"] == "error"
    assert estado["backend"] == "RedisChannelLayer"
    # el endpoint es publico: nada de host, puerto ni clave
    assert "127.0.0.1" not in str(estado)
    assert "clave-secreta" not in str(estado)


@pytest.mark.django_db
@override_settings(CHANNEL_LAYERS=REDIS_CAIDO)
def test_health_sigue_ok_si_solo_falla_el_tiempo_real():
    r = APIClient().get("/api/health/")

    assert r.status_code == 200
    assert r.data["estado"] == "ok"
    assert r.data["tiempo_real"]["estado"] == "error"
