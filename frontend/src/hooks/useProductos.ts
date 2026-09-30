import { useState, useEffect, useCallback } from "react";
import productoService from "../services/productoService";
import type { Producto } from "../types";

export default function useProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Todos los setState van dentro de callbacks de la promesa, asi el
  // efecto de montaje no actualiza estado de forma sincrona
  // (react-hooks/set-state-in-effect).
  const cargar = useCallback(() =>
    productoService.listar()
      .then(({ data }) => {
        setProductos((Array.isArray(data) ? data : data.results).slice().sort((a, b) => a.id - b.id));
        setError(null);
      })
      .catch(() => setError("Error al cargar productos"))
      .finally(() => setCargando(false)),
  []);

  const recargar = useCallback(() => {
    setCargando(true);
    return cargar();
  }, [cargar]);

  useEffect(() => { cargar(); }, [cargar]);

  return { productos, cargando, error, recargar };
}
