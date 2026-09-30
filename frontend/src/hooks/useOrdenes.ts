import { useState, useEffect, useCallback } from "react";
import ordenesService from "../services/ordenesService";
import type { CrearOrdenPayload } from "../services/ordenesService";
import { getErrorMessage } from "../utils/errors";
import type { Orden } from "../types";

export function useOrdenes() {
  const [ordenes, setOrdenes]   = useState<Orden[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  // Todos los setState van dentro de callbacks de la promesa, asi el
  // efecto de montaje no actualiza estado de forma sincrona
  // (react-hooks/set-state-in-effect).
  const obtener = useCallback(() =>
    ordenesService.listar()
      .then(({ data }) => {
        setOrdenes(Array.isArray(data) ? data : (data.results ?? []));
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err, "Error al cargar órdenes")))
      .finally(() => setLoading(false)),
  []);

  const cargar = useCallback(() => {
    setLoading(true);
    return obtener();
  }, [obtener]);

  useEffect(() => { obtener(); }, [obtener]);

  const crear = useCallback(async (payload: CrearOrdenPayload) => {
    const { data } = await ordenesService.crear(payload);
    setOrdenes((prev) => [data, ...prev]);
    return data;
  }, []);

  const anular = useCallback(async (ordenId: number) => {
    const { data } = await ordenesService.anular(ordenId);
    setOrdenes((prev) => prev.map((o) => (o.id === data.id ? data : o)));
    return data;
  }, []);

  const eliminarDetalle = useCallback(async (ordenId: number, detalleId: number) => {
    const { data } = await ordenesService.eliminarDetalle(ordenId, detalleId);
    setOrdenes((prev) => prev.map((o) => (o.id === data.id ? data : o)));
    return data;
  }, []);

  const marcarImpreso = useCallback(async (ordenId: number, detalleIds: number[]) => {
    const { data } = await ordenesService.marcarImpreso(ordenId, detalleIds);
    setOrdenes((prev) => prev.map((o) => (o.id === data.id ? data : o)));
    return data;
  }, []);

  const ordenesAbiertas  = ordenes.filter((o) => o.estado === "abierta");
  const ordenesCerradas  = ordenes.filter((o) => o.estado === "cerrada");
  const ordenesAnuladas  = ordenes.filter((o) => o.estado === "anulada");

  return {
    ordenes,
    ordenesAbiertas,
    ordenesCerradas,
    ordenesAnuladas,
    loading,
    error,
    cargar,
    crear,
    anular,
    eliminarDetalle,
    marcarImpreso,
  };
}
