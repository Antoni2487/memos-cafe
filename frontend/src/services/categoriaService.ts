import api from "./api";
import type { Categoria, Paginated } from "../types";

const categoriaService = {
  listar:     ()                       => api.get<Paginated<Categoria> | Categoria[]>("/productos/categorias/"),
  crear:      (nombre: string)         => api.post<Categoria>("/productos/categorias/crear/", { nombre }),
  editar:     (id: number, nombre: string) => api.patch<Categoria>(`/productos/categorias/${id}/editar/`, { nombre }),
  activar:    (id: number)             => api.post<Categoria>(`/productos/categorias/${id}/activar/`),
  desactivar: (id: number)             => api.post<Categoria>(`/productos/categorias/${id}/desactivar/`),
};

export default categoriaService;
