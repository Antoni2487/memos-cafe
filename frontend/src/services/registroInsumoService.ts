import api, { getAll } from "./api";
import type { RegistroInsumo } from "../types";

export interface RegistrarInsumoPayload {
  insumo: number | string;
  cantidad: number | string;
  costo_unitario: number | string;
  proveedor?: string;
  observaciones?: string;
}

const registroInsumoService = {
  listar: (params?: Record<string, unknown>) => getAll<RegistroInsumo>("/insumos/registros/", params),
  registrar: (data: RegistrarInsumoPayload) => api.post<RegistroInsumo>("/insumos/registros/registrar/", data),
};

export default registroInsumoService;
