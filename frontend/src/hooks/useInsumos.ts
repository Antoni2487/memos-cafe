import { useState, useEffect, useCallback } from "react";
import insumoService from "../services/insumoService";
import type { Insumo } from "../types";

export default function useInsumos() {
    const [insumos, setInsumos] = useState<Insumo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        try {
            setCargando(true);
            setError(null);
            const { data } = await insumoService.listar();
            const lista = (Array.isArray(data) ? data : data.results).slice().sort((a, b) => a.id - b.id);
            setInsumos(lista);
        } catch {
            setError("Error al cargar insumos");
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    return { insumos, cargando, error, recargar: cargar };
}
