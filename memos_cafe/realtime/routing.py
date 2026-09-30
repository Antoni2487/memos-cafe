from django.urls import path

from memos_cafe.realtime import consumers

websocket_urlpatterns = [
    path("ws/cocina/", consumers.CocinaConsumer.as_asgi()),
    path("ws/meseros/", consumers.MeseroConsumer.as_asgi()),
]
