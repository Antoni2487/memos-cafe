import api from "./api";
import type { Insumo, Paginated } from "../types";

export interface InsumoFormData {
  nombre: string;
  unidad: string;
  stock_minimo: number | string;
}

const insumoService = {
  listar: (params?: Record<string, unknown>) => api.get<Paginated<Insumo> | Insumo[]>("/insumos/", { params }),
  crear: (data: InsumoFormData) => api.post<Insumo>("/insumos/crear/", data),
  editar: (id: number, data: InsumoFormData) => api.patch<Insumo>(`/insumos/${id}/editar/`, data),
  activar: (id: number) => api.post<Insumo>(`/insumos/${id}/activar/`),
  desactivar: (id: number) => api.post<Insumo>(`/insumos/${id}/desactivar/`),
};

export default insumoService;
