import api, { getAll } from "./api";
import type { ElementoPlano, EstadoMesa, GeometriaPlano, Mesa, PedidoPorConfirmarQR, Plano } from "../types";

export interface PedidoPorConfirmar extends PedidoPorConfirmarQR {
  mesa: number;
  mesa_numero: number;
}

export interface MesaFormData extends Partial<GeometriaPlano> {
  numero: number;
  capacidad: number;
}

export interface GuardarPlano {
  mesas: (Partial<GeometriaPlano> & { id: number })[];
  elementos: ElementoPlano[];
}

const mesasService = {
  listar:        ()                                  => getAll<Mesa>("/mesas/"),
  crear:         (data: MesaFormData)                => api.post<Mesa>("/mesas/", data),
  editar:        (id: number, data: MesaFormData)    => api.put<Mesa>(`/mesas/${id}/`, data),
  darDeBaja:     (id: number)                        => api.delete(`/mesas/${id}/`),
  cambiarEstado: (id: number, estado: EstadoMesa)    => api.patch<Mesa>(`/mesas/${id}/estado/`, { estado }),
  regenerarQR:   (id: number)                        => api.post<Mesa>(`/mesas/${id}/regenerar-qr/`),
  // Primer pedido por QR de una mesa libre: el mesero confirma que hay gente
  porConfirmar:  ()                                  => api.get<PedidoPorConfirmar[]>("/mesas/pedidos-por-confirmar/"),
  confirmarPedido: (id: number)                      => api.post<{ orden_id: number; mesa_numero: number }>(`/mesas/pedidos-por-confirmar/${id}/confirmar/`),
  rechazarPedido: (id: number)                       => api.post(`/mesas/pedidos-por-confirmar/${id}/rechazar/`),
  // Croquis del salón: el mesero lo ve con lo que pasa en cada mesa, el admin lo edita
  plano:         ()                                  => api.get<Plano>("/mesas/plano/"),
  guardarPlano:  (data: GuardarPlano)                => api.put<Plano>("/mesas/plano/", data),
};

export default mesasService;
