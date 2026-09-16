import { useState, useEffect, useCallback } from "react";
import productoService from "../services/productoService";
import type { Producto } from "../types";

export default function useProductos() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando]   = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setCargando(true);
      setError(null);
      const { data } = await productoService.listar();
      const lista = (Array.isArray(data) ? data : data.results).slice().sort((a, b) => a.id - b.id);
      setProductos(lista);
    } catch {
      setError("Error al cargar productos");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return { productos, cargando, error, recargar: cargar };
}
