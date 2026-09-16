import api from "./api";
import type { Paginated, PermisoRol } from "../types";

const rolesService = {
  getAll:  ()                                        => api.get<Paginated<PermisoRol> | PermisoRol[]>("/roles/permisos/"),
  update:  (pk: number, data: Partial<PermisoRol>)   => api.patch<PermisoRol>(`/roles/permisos/${pk}/`, data),
};

export default rolesService;
