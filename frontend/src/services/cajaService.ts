import api from "./api";
import type { CajaSesion, Movimiento, Pago } from "../types";

export interface AbrirSesionPayload {
  monto_inicial: number | string;
}

export interface CerrarSesionPayload {
  monto_final: number | string;
  observaciones?: string;
}

export interface MovimientoPayload {
  tipo: "entrada" | "salida";
  monto: number | string;
  motivo: string;
}

export interface ProcesarPagoPayload {
  orden: number;
  metodo_pago: string;
  monto: number;
  monto_recibido?: number;
  numero_operacion?: string;
}

export interface AnularPagoPayload {
  motivo: string;
  detalle: string;
}

export interface EmitirComprobantePayload {
  pago: number;
  tipo: string;
  serie: string;
  numero: number;
  cliente_nombre: string;
  cliente_ruc_dni: string;
  cliente_direccion: string;
}

const cajaService = {
  // Sesión
  obtenerEstado: () => api.get<CajaSesion>("/caja/sesiones/estado/"),
  abrirSesion: (datos: AbrirSesionPayload) => api.post<CajaSesion>("/caja/sesiones/abrir/", datos),
  cerrarSesion: (datos: CerrarSesionPayload) => api.post<CajaSesion>("/caja/sesiones/cerrar/", datos),

  // Movimientos
  listarMovimientos: () => api.get<Movimiento[] | { results: Movimiento[] }>("/caja/movimientos/"),
  registrarMovimiento: (datos: MovimientoPayload) => api.post<Movimiento>("/caja/movimientos/", datos),

  // Pagos
  listarPagos: () => api.get<Pago[] | { results: Pago[] }>("/caja/pagos/"),
  procesarPago: (datos: ProcesarPagoPayload) => api.post<Pago>("/caja/pagos/procesar/", datos),
  anularPago: (id: number, payload: AnularPagoPayload) => api.post<Pago>(`/caja/pagos/${id}/anular/`, payload),

  // Comprobantes
  emitirComprobante: (datos: EmitirComprobantePayload) => api.post("/caja/comprobantes/emitir/", datos),
};

export default cajaService;
