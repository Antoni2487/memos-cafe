import api from "./api";
import type { Paginated, Promocion } from "../types";

export interface PromocionFormData {
  nombre: string;
  descripcion?: string;
  precio: number | string;
  fecha_inicio: string;
  fecha_fin: string;
  imagen?: File | string | null;
}

/**
 * Convierte el objeto plano del formulario a FormData.
 * No se fija Content-Type manualmente: axios lo detecta solo al ver una
 * instancia de FormData y agrega el boundary correcto automaticamente.
 * Fijarlo a mano rompe el request (falta el boundary).
 */
function toFormData(data: PromocionFormData): FormData {
  const fd = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (key === "imagen") {
      if (value instanceof File) fd.append("imagen", value);
      return;
    }
    if (value !== undefined && value !== null) fd.append(key, String(value));
  });
  return fd;
}

const promocionService = {
  getAll:     ()                                       => api.get<Paginated<Promocion> | Promocion[]>("/productos/promociones/"),
  getById:    (id: number)                             => api.get<Promocion>(`/productos/promociones/${id}/`),
  crear:      (data: PromocionFormData)                => api.post<Promocion>("/productos/promociones/crear/", toFormData(data)),
  editar:     (id: number, data: PromocionFormData)    => api.patch<Promocion>(`/productos/promociones/${id}/editar/`, toFormData(data)),
  activar:    (id: number)                             => api.post<Promocion>(`/productos/promociones/${id}/activar/`),
  desactivar: (id: number)                             => api.post<Promocion>(`/productos/promociones/${id}/desactivar/`),
};

export default promocionService;
