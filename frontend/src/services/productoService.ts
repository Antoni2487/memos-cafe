import api, { getAll } from "./api";
import type { Producto, Promocion } from "../types";

export interface ProductoFormData {
  nombre: string;
  descripcion?: string;
  precio: number | string;
  categoria: number | string;
  imagen?: File | string | null;
}

function toFormData(data: ProductoFormData): FormData {
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

const productoService = {
  listar: () => getAll<Producto>("/productos/"),
  listarPromociones: () => getAll<Promocion>("/productos/promociones/"),
  // Sin login — carta para /pedir/:codigo (ver ProductoViewSet.publico)
  listarPublico: () => getAll<Producto>("/productos/publico/"),
  crear: (data: ProductoFormData) => api.post<Producto>("/productos/crear/", toFormData(data)),
  editar: (id: number, data: ProductoFormData) => api.patch<Producto>(`/productos/${id}/editar/`, toFormData(data)),
  activar: (id: number) => api.post<Producto>(`/productos/${id}/activar/`),
  desactivar: (id: number) => api.post<Producto>(`/productos/${id}/desactivar/`),

  // ── Galería (ver FotoProductoService en el backend) ───────────────────────
  // Cada llamada devuelve el producto con la galería ya actualizada.
  subirFoto: (id: number, imagen: File, onProgreso?: (porcentaje: number) => void) => {
    const fd = new FormData();
    fd.append("imagen", imagen);
    return api.post<Producto>(`/productos/${id}/fotos/`, fd, {
      onUploadProgress: (e) => {
        if (onProgreso && e.total) onProgreso(Math.round((e.loaded * 100) / e.total));
      },
    });
  },
  ordenarFotos: (id: number, orden: number[]) => api.post<Producto>(`/productos/${id}/fotos/ordenar/`, { orden }),
  hacerPortada: (id: number, fotoId: number) => api.post<Producto>(`/productos/${id}/fotos/${fotoId}/portada/`),
  eliminarFoto: (id: number, fotoId: number) => api.delete<Producto>(`/productos/${id}/fotos/${fotoId}/`),
  quitarPortada: (id: number) => api.delete<Producto>(`/productos/${id}/fotos/portada/`),
};

export default productoService;
