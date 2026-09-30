"""Endpoints publicos (sin login) del pedido por QR — cliente final desde
su celular. Unica superficie no autenticada del sistema ademas de
/api/health/, asi que cada vista tiene su propio throttle dedicado (mismo
patron que LoginRateThrottle) y valida todo contra la mesa/sesion real:
no hay nada mas de proteccion (sin CAPTCHA).

Nunca tocan el ORM ni ordenes/caja directo: todo pasa por
SesionMesaService (mesas/services.py), que es quien conoce el cruce hacia
esas apps — ver .importlinter, contrato "vistas-no-cruzan-apps-de-negocio"."""

from rest_framework.exceptions import ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from memos_cafe.mesas.api.serializers import (
    OrdenQRSerializer,
    PedidoQRSerializer,
    SesionMesaQREstadoSerializer,
    SolicitarCobroQRSerializer,
)
from memos_cafe.mesas.api import throttles
from memos_cafe.mesas.models import Mesa
from memos_cafe.mesas.services import SesionMesaService


def _mesa_activa_o_404(codigo):
    """La URL publica lleva el codigo secreto de la mesa (el que va impreso
    en el QR), nunca su id: un id correlativo permitia pedir a cualquier
    mesa desde fuera del local probando numeros."""
    return get_object_or_404(Mesa, codigo_qr=codigo, activo=True)


class MesaQREstadoView(APIView):
    """GET /api/mesas/qr/<codigo>/ — el frontend cliente pega aca apenas
    escanea el QR para saber si hay un pedido abierto y que tiene hasta
    ahora."""
    permission_classes = []
    throttle_classes = throttles.LECTURA

    def get(self, request, codigo):
        mesa = _mesa_activa_o_404(codigo)
        sesion = SesionMesaService.sesion_activa(mesa)

        orden = None
        if sesion:
            orden = (
                mesa.ordenes.filter(estado="abierta")
                .order_by("-fecha_creacion")
                .first()
            )

        data = {
            "sesion_activa": sesion is not None,
            "mesa_numero": mesa.numero,
            "orden": orden,  # instancia cruda o None — el campo nested
            # OrdenQRSerializer de SesionMesaQREstadoSerializer la serializa
            # el solo; pre-serializarla aca duplicaba el paso y rompia con
            # 'dict' object has no attribute 'producto_id'.
        }
        return Response(SesionMesaQREstadoSerializer(data).data)


class MesaQRPedidoView(APIView):
    """POST /api/mesas/qr/<codigo>/pedido/ — el cliente confirma su
    carrito (pedido inicial o una ronda mas)."""
    permission_classes = []
    throttle_classes = throttles.PEDIDO

    def post(self, request, codigo):
        mesa = _mesa_activa_o_404(codigo)
        serializer = PedidoQRSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            orden = SesionMesaService.registrar_pedido(
                mesa=mesa, items=serializer.validated_data["items"]
            )
        except ValueError as e:
            raise ValidationError({"detail": str(e)})

        return Response(OrdenQRSerializer(orden).data, status=201)


class MesaQRSolicitarCobroView(APIView):
    """POST /api/mesas/qr/<codigo>/solicitar-cobro/ — el cliente termino
    y avisa que quiere pagar. No es un Pago real: el cajero/mesero sigue
    cobrando fisicamente como hoy, esto solo notifica al personal."""
    permission_classes = []
    throttle_classes = throttles.COBRO

    def post(self, request, codigo):
        mesa = _mesa_activa_o_404(codigo)
        serializer = SolicitarCobroQRSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            SesionMesaService.solicitar_cobro(
                mesa=mesa,
                metodo_pago_sugerido=serializer.validated_data["metodo_pago_sugerido"],
            )
        except ValueError as e:
            raise ValidationError({"detail": str(e)})

        return Response(status=201)
