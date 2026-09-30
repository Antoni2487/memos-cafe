import api, { getAll } from "./api";
import type { PermisoRol } from "../types";

const rolesService = {
  getAll:  ()                                        => getAll<PermisoRol>("/roles/permisos/"),
  update:  (pk: number, data: Partial<PermisoRol>)   => api.patch<PermisoRol>(`/roles/permisos/${pk}/`, data),
};

export default rolesService;
