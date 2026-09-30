import { useState, useEffect } from "react";
import rolesService from "../services/rolesService";
import type { PermisoRol } from "../types";

export interface ModuloPermisos {
  modulo: string;
  label: string;
  roles: Record<string, PermisoRol>;
}

export default function useRoles() {
  const [permisos, setPermisos]   = useState<PermisoRol[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [exito, setExito]         = useState(false);

  // setState solo dentro de callbacks de la promesa
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    rolesService.getAll()
      .then(({ data }) => setPermisos("results" in data ? data.results : data))
      .catch(() => setError("Error al cargar los permisos."))
      .finally(() => setCargando(false));
  }, []);

  const handleToggle = async (permiso: PermisoRol) => {
    // Optimistic update — actualiza UI antes de la respuesta
    setPermisos((prev) =>
      prev.map((p) =>
        p.id === permiso.id ? { ...p, puede_acceder: !p.puede_acceder } : p
      )
    );

    try {
      setGuardando(true);
      setError(null);
      await rolesService.update(permiso.id, { puede_acceder: !permiso.puede_acceder });
      setExito(true);
      setTimeout(() => setExito(false), 2000);
    } catch {
      // Revierte si falla
      setPermisos((prev) =>
        prev.map((p) =>
          p.id === permiso.id ? { ...p, puede_acceder: permiso.puede_acceder } : p
        )
      );
      setError("Error al actualizar el permiso.");
    } finally {
      setGuardando(false);
    }
  };

  // Agrupa permisos por módulo para la tabla
  const porModulo = permisos.reduce<Record<string, ModuloPermisos>>((acc, p) => {
    if (!acc[p.modulo]) {
      acc[p.modulo] = { modulo: p.modulo, label: p.modulo_label, roles: {} };
    }
    acc[p.modulo].roles[p.rol] = p;
    return acc;
  }, {});

  return {
    porModulo,
    cargando,
    guardando,
    error,
    exito,
    setError,
    handleToggle,
  };
}
