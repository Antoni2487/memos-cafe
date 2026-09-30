import api from "./api";
import type { OrdenQR, PedidoPorConfirmarQR, RespuestaPedidoQR, SesionMesaQREstado } from "../types";

export interface ItemPedidoQRPayload {
  producto?: number | null;
  promocion?: number | null;
  cantidad: number;
  nota?: string;
}

const CLAVE_DISPOSITIVO = "pedido_qr_dispositivo";

function generarId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  // Navegadores viejos: UUID v4 con Math.random (solo identifica, no es secreto)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Id aleatorio y persistente de este celular. El backend lo usa para que los
 * limites de uso sean por persona y no por mesa (ver
 * memos_cafe/mesas/api/throttles.py). No es un secreto ni autentica nada.
 */
function idDispositivo(): string {
  try {
    let id = localStorage.getItem(CLAVE_DISPOSITIVO);
    if (!id) {
      id = generarId();
      localStorage.setItem(CLAVE_DISPOSITIVO, id);
    }
    return id;
  } catch {
    return generarId(); // navegacion privada sin localStorage
  }
}

/** URL publica que va impresa en el QR de una mesa. */
export function urlPedidoQR(codigoQR: string): string {
  return `${window.location.origin}/pedir/${codigoQR}`;
}

// Endpoints publicos (sin login) del pedido por QR — ver
// memos_cafe/mesas/api/qr_views.py. La URL lleva el codigo secreto de la
// mesa (el del QR impreso), nunca su id.
const conDispositivo = () => ({ headers: { "X-Dispositivo-QR": idDispositivo() } });

const pedidoQRService = {
  estado: (codigo: string) =>
    api.get<SesionMesaQREstado>(`/mesas/qr/${codigo}/`, conDispositivo()),
  // 201: la mesa ya tenia pedido, va directo a Cocina.
  // 202: primer pedido de una mesa libre, espera que el mesero lo confirme.
  pedir: async (codigo: string, items: ItemPedidoQRPayload[]): Promise<RespuestaPedidoQR> => {
    const { data, status } = await api.post<OrdenQR | { pedido_por_confirmar: PedidoPorConfirmarQR }>(
      `/mesas/qr/${codigo}/pedido/`,
      { items },
      conDispositivo()
    );
    if (status === 202 && "pedido_por_confirmar" in data) {
      return { tipo: "por_confirmar", pedido: data.pedido_por_confirmar };
    }
    return { tipo: "orden", orden: data as OrdenQR };
  },
  solicitarCobro: (codigo: string, metodoPagoSugerido: string) =>
    api.post(
      `/mesas/qr/${codigo}/solicitar-cobro/`,
      { metodo_pago_sugerido: metodoPagoSugerido },
      conDispositivo()
    ),
};

export default pedidoQRService;
