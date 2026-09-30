import { useState, useEffect, useCallback } from "react";
import insumoService from "../services/insumoService";
import type { Insumo } from "../types";

export default function useInsumos() {
    const [insumos, setInsumos] = useState<Insumo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Todos los setState van dentro de callbacks de la promesa, asi el
    // efecto de montaje no actualiza estado de forma sincrona
    // (react-hooks/set-state-in-effect).
    const cargar = useCallback(() =>
        insumoService.listar()
            .then(({ data }) => {
                setInsumos((Array.isArray(data) ? data : data.results).slice().sort((a, b) => a.id - b.id));
                setError(null);
            })
            .catch(() => setError("Error al cargar insumos"))
            .finally(() => setCargando(false)),
    []);

    const recargar = useCallback(() => {
        setCargando(true);
        return cargar();
    }, [cargar]);

    useEffect(() => { cargar(); }, [cargar]);

    return { insumos, cargando, error, recargar };
}
