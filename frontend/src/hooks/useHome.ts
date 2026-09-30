import { useState, useEffect, useCallback } from "react";
import homeService from "../services/homeService";
import type { Mesa, Orden } from "../types";

export default function useHome() {
  const [mesas, setMesas]     = useState<Mesa[]>([]);
  const [ordenes, setOrdenes] = useState<Orden[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Todos los setState van dentro de callbacks de la promesa, asi el
  // efecto de montaje no actualiza estado de forma sincrona
  // (react-hooks/set-state-in-effect).
  const obtener = useCallback(() =>
    Promise.all([homeService.getMesas(), homeService.getOrdenes()])
      .then(([resMesas, resOrdenes]) => {
        setMesas("results" in resMesas.data ? resMesas.data.results : resMesas.data);
        setOrdenes("results" in resOrdenes.data ? resOrdenes.data.results : resOrdenes.data);
        setError(null);
      })
      .catch(() => setError("Error al cargar la información."))
      .finally(() => setCargando(false)),
  []);

  const cargar = useCallback(() => {
    setCargando(true);
    return obtener();
  }, [obtener]);

  useEffect(() => { obtener(); }, [obtener]);

  const mesasLibres   = mesas.filter((m) => m.estado === "libre").length;
  const mesasOcupadas = mesas.filter((m) => m.estado === "ocupada").length;
  const ordenesAbiertas = ordenes.filter((o) => o.estado === "abierta").length;

  return {
    mesas, ordenes,
    mesasLibres, mesasOcupadas, ordenesAbiertas,
    totalMesas: mesas.length,
    cargando, error, cargar,
  };
}
