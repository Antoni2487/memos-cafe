from django.urls import re_path

from memos_cafe.realtime import consumers

websocket_urlpatterns = [
    re_path(r"^ws/cocina/$", consumers.CocinaConsumer.as_asgi()),
    re_path(r"^ws/meseros/$", consumers.MeseroConsumer.as_asgi()),
]
