import api from "./api";
import type { EstadoPreparacion, Orden, Paginated, TicketCocina, TipoOrden } from "../types";

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
  listar:          ()                                        => api.get<Paginated<Orden> | Orden[]>("/ordenes/"),
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
