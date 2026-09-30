import api, { getAll } from "./api";
import type { Usuario } from "../types";

export interface UsuarioFormData {
  name?: string;
  email: string;
  password?: string;
  group_name?: string;
}

const usuarioService = {
  getAll:       ()                                        => getAll<Usuario>("/users/"),
  getById:      (pk: number)                              => api.get<Usuario>(`/users/${pk}/`),
  create:       (data: UsuarioFormData)                   => api.post<Usuario>("/users/", data),
  update:       (pk: number, data: Partial<UsuarioFormData>) => api.patch<Usuario>(`/users/${pk}/`, data),
  delete:       (pk: number)                              => api.delete(`/users/${pk}/`),
  toggleActivo: (pk: number)                              => api.post<Usuario>(`/users/${pk}/toggle-activo/`),
  getMe:        ()                                        => api.get<Usuario>("/users/me/"),
};

export default usuarioService;
