import { useState, useEffect, useCallback } from "react";
import mesasService from "../services/mesasService";
import type { Mesa } from "../types";

export default function useMesas() {
  const [mesas, setMesas]     = useState<Mesa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Todos los setState van dentro de callbacks de la promesa, asi el
  // efecto de montaje no actualiza estado de forma sincrona
  // (react-hooks/set-state-in-effect).
  const cargar = useCallback(() =>
    mesasService.listar()
      .then((lista) => {
        setMesas(lista);
        setError(null);
      })
      .catch(() => setError("Error al cargar mesas"))
      .finally(() => setCargando(false)),
  []);

  const recargar = useCallback(() => {
    setCargando(true);
    return cargar();
  }, [cargar]);

  useEffect(() => { cargar(); }, [cargar]);

  return { mesas, cargando, error, recargar };
}
