import api from "./api";
import type { OrdenQR, SesionMesaQREstado } from "../types";

export interface ItemPedidoQRPayload {
  producto?: number | null;
  promocion?: number | null;
  cantidad: number;
  nota?: string;
}

// Endpoints públicos (sin login) del pedido por QR — ver
// memos_cafe/mesas/api/qr_views.py. Usan la misma instancia `api` que el
// resto de la app: si no hay token en localStorage simplemente no se manda
// Authorization, y estos endpoints no lo requieren.
const pedidoQRService = {
  estado: (mesaId: number) =>
    api.get<SesionMesaQREstado>(`/mesas/qr/${mesaId}/`),
  pedir: (mesaId: number, items: ItemPedidoQRPayload[]) =>
    api.post<OrdenQR>(`/mesas/qr/${mesaId}/pedido/`, { items }),
  solicitarCobro: (mesaId: number, metodoPagoSugerido: string) =>
    api.post(`/mesas/qr/${mesaId}/solicitar-cobro/`, {
      metodo_pago_sugerido: metodoPagoSugerido,
    }),
};

export default pedidoQRService;
