import { useState, useEffect, useCallback } from "react";
import mesasService from "../services/mesasService";
import type { Mesa } from "../types";

export default function useMesas() {
  const [mesas, setMesas]     = useState<Mesa[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const { data } = await mesasService.listar();
      const lista = "results" in data ? data.results : data;
      setMesas(lista);
    } catch {
      setError("Error al cargar mesas");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return { mesas, cargando, error, recargar: cargar };
}
