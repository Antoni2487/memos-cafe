import api, { getAll } from "./api";
import type { EstadoMesa, Mesa } from "../types";

export interface MesaFormData {
  numero: number;
  capacidad: number;
}

const mesasService = {
  listar:        ()                                  => getAll<Mesa>("/mesas/"),
  crear:         (data: MesaFormData)                => api.post<Mesa>("/mesas/", data),
  editar:        (id: number, data: MesaFormData)    => api.put<Mesa>(`/mesas/${id}/`, data),
  darDeBaja:     (id: number)                        => api.delete(`/mesas/${id}/`),
  cambiarEstado: (id: number, estado: EstadoMesa)    => api.patch<Mesa>(`/mesas/${id}/estado/`, { estado }),
};

export default mesasService;
