import { useState, useEffect, useCallback } from "react";
import registroInsumoService from "../services/registroInsumoService";
import type { RegistroInsumo } from "../types";

export default function useRegistrosInsumo() {
    const [registros, setRegistros] = useState<RegistroInsumo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Todos los setState van dentro de callbacks de la promesa, asi el
    // efecto de montaje no actualiza estado de forma sincrona
    // (react-hooks/set-state-in-effect).
    const cargar = useCallback(() =>
        registroInsumoService.listar()
            .then((lista) => {
                setRegistros(lista);
                setError(null);
            })
            .catch(() => setError("Error al cargar el historial de gastos"))
            .finally(() => setCargando(false)),
    []);

    const recargar = useCallback(() => {
        setCargando(true);
        return cargar();
    }, [cargar]);

    useEffect(() => { cargar(); }, [cargar]);

    const totalGastado = registros.reduce((acc, r) => acc + Number(r.costo_total), 0);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const gastadoEsteMes = registros
        .filter((r) => new Date(r.fecha) >= inicioMes)
        .reduce((acc, r) => acc + Number(r.costo_total), 0);

    return { registros, cargando, error, recargar, totalGastado, gastadoEsteMes };
}
