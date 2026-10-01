from decimal import Decimal

import pytest

from memos_cafe.caja.api.serializers import CajaReadSerializer
from memos_cafe.caja.models import Caja
from memos_cafe.caja.models import MovimientoCaja
from memos_cafe.caja.models import NotaCredito
from memos_cafe.caja.models import Pago
from memos_cafe.caja.models import SolicitudCobro
from memos_cafe.caja.services import CajaService
from memos_cafe.caja.services import ComprobanteService
from memos_cafe.caja.services import PagoService
from memos_cafe.caja.tests.factories import CajaFactory
from memos_cafe.caja.tests.factories import OrdenFactory
from memos_cafe.ordenes.models import Orden
from memos_cafe.users.tests.factories import UserFactory

pytestmark = pytest.mark.django_db


class TestCajaService:
    def test_abrir_sesion(self):
        user = UserFactory()
        caja = CajaService.abrir_sesion(user, Decimal("200.00"))
        assert caja.estado == Caja.Estado.ABIERTA
        assert caja.monto_inicial == Decimal("200.00")
        assert caja.usuario == user

    def test_abrir_sesion_ya_existe_lanza_error(self):
        user = UserFactory()
        CajaFactory()  # caja ya abierta
        with pytest.raises(ValueError, match="Ya existe"):
            CajaService.abrir_sesion(user, Decimal("100.00"))

    def test_cerrar_sesion(self):
        CajaFactory()
        caja = CajaService.cerrar_sesion(Decimal("350.00"), "Cierre normal")
        assert caja.estado == Caja.Estado.CERRADA
        assert caja.monto_final == Decimal("350.00")
        assert caja.fecha_cierre is not None

    def test_cerrar_sesion_sin_caja_abierta_lanza_error(self):
        with pytest.raises(ValueError, match="No hay"):
            CajaService.cerrar_sesion(Decimal("100.00"))

    def test_cerrar_sesion_con_observaciones(self):
        CajaFactory()
        caja = CajaService.cerrar_sesion(Decimal("100.00"), "Faltaron S/5")
        assert caja.observaciones == "Faltaron S/5"

    def test_monto_inicial_cero_permitido(self):
        user = UserFactory()
        caja = CajaService.abrir_sesion(user, Decimal("0.00"))
        assert caja.monto_inicial == Decimal("0.00")

    def test_registrar_movimiento_entrada(self):
        CajaFactory()
        mov = CajaService.registrar_movimiento(
            tipo=MovimientoCaja.Tipo.ENTRADA,
            monto=Decimal("50.00"),
            motivo="Fondo adicional",
        )
        assert mov.tipo == MovimientoCaja.Tipo.ENTRADA
        assert mov.monto == Decimal("50.00")

    def test_registrar_movimiento_salida(self):
        CajaFactory()
        mov = CajaService.registrar_movimiento(
            tipo=MovimientoCaja.Tipo.SALIDA,
            monto=Decimal("20.00"),
            motivo="Compra de insumos",
        )
        assert mov.tipo == MovimientoCaja.Tipo.SALIDA

    def test_registrar_movimiento_monto_cero_lanza_error(self):
        CajaFactory()
        with pytest.raises(ValueError, match="mayor a 0"):
            CajaService.registrar_movimiento(
                tipo=MovimientoCaja.Tipo.ENTRADA,
                monto=Decimal("0"),
                motivo="test",
            )

    def test_registrar_movimiento_sin_caja_abierta_lanza_error(self):
        with pytest.raises(ValueError, match="No hay"):
            CajaService.registrar_movimiento(
                tipo=MovimientoCaja.Tipo.ENTRADA,
                monto=Decimal("50.00"),
                motivo="test",
            )


class TestCerrarSesionConDiscrepancia:
    """CajaService.cerrar_sesion exige observaciones cuando el faltante/
    sobrante supera UMBRAL_DIFERENCIA_SIN_OBSERVACION (S/5.00)."""

    @pytest.fixture
    def caja_sin_ventas(self):
        return CajaFactory(monto_inicial=Decimal("100.00"))

    def test_discrepancia_grande_sin_observaciones_lanza_error(self, caja_sin_ventas):
        # esperado = 100 (inicial) + 0 (ventas) + 0 (movimientos) = 100
        # contado = 200 -> diferencia = 100, supera el umbral de 5
        with pytest.raises(ValueError, match="supera el margen permitido"):
            CajaService.cerrar_sesion(Decimal("200.00"))
        caja_sin_ventas.refresh_from_db()
        assert caja_sin_ventas.estado == Caja.Estado.ABIERTA  # no se cerro

    def test_discrepancia_grande_con_observaciones_permite_cierre(
        self,
        caja_sin_ventas,
    ):
        caja = CajaService.cerrar_sesion(
            Decimal("200.00"),
            "Faltante grande, revisar con el turno siguiente",
        )
        assert caja.estado == Caja.Estado.CERRADA
        assert caja.monto_final == Decimal("200.00")

    @pytest.mark.parametrize(
        "monto_final",
        [Decimal("100.00"), Decimal("104.99"), Decimal("95.01")],
    )
    def test_discrepancia_dentro_del_margen_no_exige_observaciones(
        self,
        caja_sin_ventas,
        monto_final,
    ):
        # dentro de +-5.00 del esperado (100): no debe exigir observaciones
        caja = CajaService.cerrar_sesion(monto_final)
        assert caja.estado == Caja.Estado.CERRADA
        assert caja.observaciones == ""


class TestMovimientoCajaNeto:
    """El badge/lista de movimientos y el cuadre de caja dependen de que
    neto_por_caja sume entradas y reste salidas, no solo salidas."""

    def test_neto_por_caja_solo_entradas(self):
        caja = CajaFactory()
        CajaService.registrar_movimiento(
            tipo=MovimientoCaja.Tipo.ENTRADA,
            monto=Decimal("30.00"),
            motivo="Fondo",
        )
        CajaService.registrar_movimiento(
            tipo=MovimientoCaja.Tipo.ENTRADA,
            monto=Decimal("20.00"),
            motivo="Fondo 2",
        )
        assert MovimientoCaja.objects.neto_por_caja(caja) == Decimal("50.00")

    def test_neto_por_caja_solo_salidas(self):
        caja = CajaFactory()
        CajaService.registrar_movimiento(
            tipo=MovimientoCaja.Tipo.SALIDA,
            monto=Decimal("15.00"),
            motivo="Compra",
        )
        assert MovimientoCaja.objects.neto_por_caja(caja) == Decimal("-15.00")

    def test_neto_por_caja_entradas_y_salidas_mixtas(self):
        """Caso critico: una entrada y una salida en la misma caja deben
        netearse, no ignorarse una de las dos."""
        caja = CajaFactory()
        CajaService.registrar_movimiento(
            tipo=MovimientoCaja.Tipo.ENTRADA,
            monto=Decimal("100.00"),
            motivo="Fondo adicional",
        )
        CajaService.registrar_movimiento(
            tipo=MovimientoCaja.Tipo.SALIDA,
            monto=Decimal("30.00"),
            motivo="Compra de insumos",
        )
        assert MovimientoCaja.objects.neto_por_caja(caja) == Decimal("70.00")
        assert caja.movimientos.count() == 2

    def test_neto_por_caja_sin_movimientos_es_cero(self):
        caja = CajaFactory()
        assert MovimientoCaja.objects.neto_por_caja(caja) == Decimal("0")

    def test_esperado_en_caja_incluye_entrada_y_salida(self):
        """CajaReadSerializer.esperado_en_caja debe sumar el fondo inicial,
        las ventas y el neto de movimientos (no solo las salidas)."""
        caja = CajaFactory(monto_inicial=Decimal("100.00"))
        orden = OrdenFactory(estado="abierta", total=Decimal("50.00"))
        PagoService.procesar_pago(
            orden=orden,
            metodo_pago="efectivo",
            monto=Decimal("50.00"),
        )
        CajaService.registrar_movimiento(
            tipo=MovimientoCaja.Tipo.ENTRADA,
            monto=Decimal("40.00"),
            motivo="Fondo adicional",
        )
        CajaService.registrar_movimiento(
            tipo=MovimientoCaja.Tipo.SALIDA,
            monto=Decimal("25.00"),
            motivo="Compra de insumos",
        )

        data = CajaReadSerializer(caja).data
        # 100 (inicial) + 50 (ventas) + 40 (entrada) - 25 (salida) = 165
        assert data["movimientos_neto"] == Decimal("15.00")
        assert data["esperado_en_caja"] == Decimal("165.00")

    def test_cerrar_sesion_diferencia_cero_con_movimientos_mixtos_cuadrados(self):
        """El cierre no debe exigir observaciones si la caja cuadra
        exactamente, incluyendo entradas y salidas manuales."""
        CajaFactory(monto_inicial=Decimal("100.00"))
        CajaService.registrar_movimiento(
            tipo=MovimientoCaja.Tipo.ENTRADA,
            monto=Decimal("40.00"),
            motivo="Fondo adicional",
        )
        CajaService.registrar_movimiento(
            tipo=MovimientoCaja.Tipo.SALIDA,
            monto=Decimal("25.00"),
            motivo="Compra de insumos",
        )
        # esperado = 100 + 0 (sin ventas) + 40 - 25 = 115
        caja_cerrada = CajaService.cerrar_sesion(Decimal("115.00"))
        assert caja_cerrada.estado == Caja.Estado.CERRADA
        assert CajaReadSerializer(caja_cerrada).data["diferencia"] == Decimal("0.00")


class TestCajaModel:
    def test_esta_abierta_property(self):
        caja = CajaFactory()
        assert caja.esta_abierta is True

    def test_cerrar_modelo(self):
        caja = CajaFactory()
        caja.cerrar(Decimal("200.00"), "ok")
        assert caja.estado == Caja.Estado.CERRADA

    def test_cerrar_caja_ya_cerrada_lanza_error(self):
        caja = CajaFactory(estado=Caja.Estado.CERRADA)
        with pytest.raises(ValueError, match="ya esta cerrada"):
            caja.cerrar(Decimal("100.00"))


class TestPagoService:
    def test_procesar_pago_exitoso(self):
        CajaFactory()
        orden = OrdenFactory(estado="abierta", total=Decimal("50.00"))
        pago = PagoService.procesar_pago(
            orden=orden,
            metodo_pago=Pago.MetodoPago.EFECTIVO,
            monto=Decimal("50.00"),
            monto_recibido=Decimal("60.00"),
        )
        assert pago.monto == Decimal("50.00")
        assert pago.vuelto == Decimal("10.00")
        assert pago.estado == Pago.Estado.COMPLETADO

    def test_procesar_pago_cierra_orden(self):

        CajaFactory()
        orden = OrdenFactory(estado="abierta", total=Decimal("30.00"))
        PagoService.procesar_pago(
            orden=orden,
            metodo_pago=Pago.MetodoPago.YAPE,
            monto=Decimal("30.00"),
        )
        orden.refresh_from_db()
        assert orden.estado == Orden.Estado.CERRADA

    def test_cobrar_atiende_el_pedido_de_cuenta(self):
        """Si el cliente pidio la cuenta por QR, al cobrarse la orden deja
        de figurar como pendiente (en el salon y en las alertas)."""
        CajaFactory()
        orden = OrdenFactory(estado="abierta", total=Decimal("30.00"))
        SolicitudCobro.objects.create(orden=orden, metodo_pago_sugerido="yape")

        PagoService.procesar_pago(
            orden=orden,
            metodo_pago="yape",
            monto=Decimal("10.00"),
        )
        assert (
            SolicitudCobro.objects.get(orden=orden).atendido_en is None
        )  # falta pagar

        PagoService.procesar_pago(
            orden=orden,
            metodo_pago="yape",
            monto=Decimal("20.00"),
        )
        assert SolicitudCobro.objects.get(orden=orden).atendido_en is not None

    def test_procesar_pago_monto_insuficiente_lanza_error(self):
        CajaFactory()
        orden = OrdenFactory(estado="abierta", total=Decimal("50.00"))
        with pytest.raises(ValueError, match="insuficiente"):
            PagoService.procesar_pago(
                orden=orden,
                metodo_pago=Pago.MetodoPago.EFECTIVO,
                monto=Decimal("50.00"),
                monto_recibido=Decimal("30.00"),
            )

    def test_procesar_pago_orden_no_abierta_lanza_error(self):
        CajaFactory()
        orden = OrdenFactory(estado="cerrada", total=Decimal("50.00"))
        with pytest.raises(ValueError, match="abiertas"):
            PagoService.procesar_pago(
                orden=orden,
                metodo_pago=Pago.MetodoPago.EFECTIVO,
                monto=Decimal("50.00"),
            )

    def test_procesar_pago_orden_ya_pagada_lanza_error(self):

        caja = CajaFactory()
        orden = OrdenFactory(estado="abierta", total=Decimal("50.00"))
        Pago.objects.create(
            orden=orden,
            caja=caja,
            metodo_pago="efectivo",
            monto=Decimal("50.00"),
            vuelto=Decimal("0"),
        )
        with pytest.raises(ValueError, match="completamente pagada"):
            PagoService.procesar_pago(
                orden=orden,
                metodo_pago=Pago.MetodoPago.EFECTIVO,
                monto=Decimal("50.00"),
            )

    def test_anular_pago(self):
        CajaFactory()
        orden = OrdenFactory(estado="abierta", total=Decimal("50.00"))
        pago = PagoService.procesar_pago(
            orden=orden,
            metodo_pago=Pago.MetodoPago.EFECTIVO,
            monto=Decimal("50.00"),
        )
        PagoService.anular_pago(
            pago,
            motivo=NotaCredito.Motivo.ERROR_COBRO,
            usuario=UserFactory(),
        )
        pago.refresh_from_db()
        assert pago.estado == Pago.Estado.ANULADO

    def test_anular_pago_genera_movimiento_salida(self):
        caja = CajaFactory()
        orden = OrdenFactory(estado="abierta", total=Decimal("50.00"))
        pago = PagoService.procesar_pago(
            orden=orden,
            metodo_pago=Pago.MetodoPago.EFECTIVO,
            monto=Decimal("50.00"),
        )
        PagoService.anular_pago(
            pago,
            motivo=NotaCredito.Motivo.ERROR_COBRO,
            usuario=UserFactory(),
        )
        mov = MovimientoCaja.objects.filter(
            caja=caja,
            tipo=MovimientoCaja.Tipo.SALIDA,
        ).last()
        assert mov is not None
        assert mov.monto == Decimal("50.00")


class TestComprobanteService:
    def test_emitir_boleta(self):
        CajaFactory()
        orden = OrdenFactory(estado="abierta", total=Decimal("50.00"))
        pago = PagoService.procesar_pago(
            orden=orden,
            metodo_pago=Pago.MetodoPago.EFECTIVO,
            monto=Decimal("50.00"),
        )
        comp = ComprobanteService.emitir(
            pago=pago,
            tipo="boleta",
            serie="B001",
            numero=1,
        )
        assert comp.tipo == "boleta"
        assert str(comp) == "Boleta B001-00000001"

    def test_emitir_factura_sin_ruc_lanza_error(self):
        CajaFactory()
        orden = OrdenFactory(estado="abierta", total=Decimal("50.00"))
        pago = PagoService.procesar_pago(
            orden=orden,
            metodo_pago=Pago.MetodoPago.EFECTIVO,
            monto=Decimal("50.00"),
        )
        with pytest.raises(ValueError, match="RUC"):
            ComprobanteService.emitir(
                pago=pago,
                tipo="factura",
                serie="F001",
                numero=1,
                cliente_nombre="Empresa SAC",
            )

    def test_emitir_comprobante_duplicado_lanza_error(self):
        CajaFactory()
        orden = OrdenFactory(estado="abierta", total=Decimal("50.00"))
        pago = PagoService.procesar_pago(
            orden=orden,
            metodo_pago=Pago.MetodoPago.EFECTIVO,
            monto=Decimal("50.00"),
        )
        ComprobanteService.emitir(pago=pago, tipo="boleta", serie="B001", numero=1)
        with pytest.raises(ValueError, match="ya tiene un comprobante"):
            ComprobanteService.emitir(pago=pago, tipo="boleta", serie="B001", numero=2)
