import api, { getAll } from "./api";
import type { Categoria } from "../types";

const categoriaService = {
  listar:     ()                       => getAll<Categoria>("/productos/categorias/"),
  crear:      (nombre: string)         => api.post<Categoria>("/productos/categorias/crear/", { nombre }),
  editar:     (id: number, nombre: string) => api.patch<Categoria>(`/productos/categorias/${id}/editar/`, { nombre }),
  activar:    (id: number)             => api.post<Categoria>(`/productos/categorias/${id}/activar/`),
  desactivar: (id: number)             => api.post<Categoria>(`/productos/categorias/${id}/desactivar/`),
};

export default categoriaService;
