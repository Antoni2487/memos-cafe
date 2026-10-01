import api, { getAll } from "./api";
import type { EstadoPreparacion, Orden, TicketCocina, TipoOrden } from "../types";

export interface DetalleOrdenPayload {
  producto: number | null;
  promocion: number | null;
  cantidad: number;
  nota?: string;
}

export interface CrearOrdenPayload {
  tipo_orden: TipoOrden;
  mesa: number | null;
  detalles: DetalleOrdenPayload[];
  cliente_nombre?: string;
  cliente_telefono?: string;
  direccion_entrega?: string;
  plataforma_delivery?: string;
  plataforma_otra?: string;
}

const ordenesService = {
  listar:          ()                                        => getAll<Orden>("/ordenes/"),
  listarAbiertas:  ()                                        => getAll<Orden>("/ordenes/", { estado: "abierta" }),
  // Admin: ?fecha=AAAA-MM-DD para ver otro día; el resto ve su día o turno.
  listarDelDia:    (fecha?: string)                          => getAll<Orden>("/ordenes/", fecha ? { fecha } : {}),
  obtener:         (ordenId: number)                         => api.get<Orden>(`/ordenes/${ordenId}/`),
  // Varios ítems a una orden abierta: llegan a Cocina como una sola comanda.
  ronda:           (ordenId: number, detalles: DetalleOrdenPayload[]) => api.post<Orden>(`/ordenes/${ordenId}/ronda/`, { detalles }),
  crear:           (payload: CrearOrdenPayload)              => api.post<Orden>("/ordenes/crear/", payload),
  agregarDetalle:  (ordenId: number, payload: DetalleOrdenPayload) => api.post<Orden>(`/ordenes/${ordenId}/detalles/`, payload),
  eliminarDetalle: (ordenId: number, detalleId: number)      => api.delete<Orden>(`/ordenes/${ordenId}/detalles/${detalleId}/`),
  marcarImpreso:   (ordenId: number, detalleIds: number[])   => api.post<Orden>(`/ordenes/${ordenId}/marcar-impreso/`, { detalle_ids: detalleIds }),
  anular:          (ordenId: number)                         => api.post<Orden>(`/ordenes/${ordenId}/anular/`),
  // Tablero de Cocina
  cocina:          ()                                        => api.get<TicketCocina[]>("/ordenes/cocina/"),
  actualizarEstadoPreparacion: (ordenId: number, detalleId: number, estado: EstadoPreparacion) =>
    api.patch<TicketCocina>(`/ordenes/${ordenId}/detalles/${detalleId}/estado-preparacion/`, { estado_preparacion: estado }),
};

export default ordenesService;
