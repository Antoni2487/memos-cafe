import api from "./api";
import type { Paginated, RegistroInsumo } from "../types";

export interface RegistrarInsumoPayload {
  insumo: number | string;
  cantidad: number | string;
  costo_unitario: number | string;
  proveedor?: string;
  observaciones?: string;
}

const registroInsumoService = {
  listar: (params?: Record<string, unknown>) => api.get<Paginated<RegistroInsumo> | RegistroInsumo[]>("/insumos/registros/", { params }),
  registrar: (data: RegistrarInsumoPayload) => api.post<RegistroInsumo>("/insumos/registros/registrar/", data),
};

export default registroInsumoService;
