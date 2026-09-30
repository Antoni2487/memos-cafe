import { useState, useEffect, useCallback } from "react";
import promocionService from "../services/promocionService";
import type { Promocion } from "../types";

export default function usePromociones() {
    const [promociones, setPromociones] = useState<Promocion[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Todos los setState van dentro de callbacks de la promesa, asi el
    // efecto de montaje no actualiza estado de forma sincrona
    // (react-hooks/set-state-in-effect).
    const cargar = useCallback(() =>
        promocionService.getAll()
            .then(({ data }) => {
                setPromociones((Array.isArray(data) ? data : data.results).slice().sort((a, b) => a.id - b.id));
                setError(null);
            })
            .catch(() => setError("Error al cargar promociones"))
            .finally(() => setCargando(false)),
    []);

    const recargar = useCallback(() => {
        setCargando(true);
        return cargar();
    }, [cargar]);

    useEffect(() => { cargar(); }, [cargar]);

    return { promociones, cargando, error, recargar };
}
