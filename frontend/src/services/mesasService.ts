import api, { getAll } from "./api";
import type { EstadoMesa, Mesa, PedidoPorConfirmarQR } from "../types";

export interface PedidoPorConfirmar extends PedidoPorConfirmarQR {
  mesa: number;
  mesa_numero: number;
}

export interface MesaFormData {
  numero: number;
  capacidad: number;
}

export interface AbrirSesionQRResponse {
  mesa: Mesa;
  token: string;
}

const mesasService = {
  listar:        ()                                  => getAll<Mesa>("/mesas/"),
  crear:         (data: MesaFormData)                => api.post<Mesa>("/mesas/", data),
  editar:        (id: number, data: MesaFormData)    => api.put<Mesa>(`/mesas/${id}/`, data),
  darDeBaja:     (id: number)                        => api.delete(`/mesas/${id}/`),
  cambiarEstado: (id: number, estado: EstadoMesa)    => api.patch<Mesa>(`/mesas/${id}/estado/`, { estado }),
  abrirSesionQR: (id: number)                        => api.post<AbrirSesionQRResponse>(`/mesas/${id}/abrir-qr/`),
  cerrarSesionQR: (id: number)                       => api.post<Mesa>(`/mesas/${id}/cerrar-qr/`),
  regenerarQR:   (id: number)                        => api.post<Mesa>(`/mesas/${id}/regenerar-qr/`),
  // Primer pedido por QR de una mesa libre: el mesero confirma que hay gente
  porConfirmar:  ()                                  => api.get<PedidoPorConfirmar[]>("/mesas/pedidos-por-confirmar/"),
  confirmarPedido: (id: number)                      => api.post<{ orden_id: number; mesa_numero: number }>(`/mesas/pedidos-por-confirmar/${id}/confirmar/`),
  rechazarPedido: (id: number)                       => api.post(`/mesas/pedidos-por-confirmar/${id}/rechazar/`),
};

export default mesasService;
