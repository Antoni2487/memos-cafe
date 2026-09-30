import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import cajaService from "../services/cajaService";
import ordenesService from "../services/ordenesService";
import authService from "../services/authService";
import type { CajaSesion, Movimiento, Orden, Pago } from "../types";

interface EstadoCaja {
    ordenesAbiertas: Orden[];
    caja: CajaSesion | null;
    movimientos: Movimiento[];
    pagos: Pago[];
}

// Un 404 en /caja/sesiones/estado/ significa "no hay sesion abierta", no un error.
async function fetchEstadoCaja(): Promise<EstadoCaja> {
    const ordenesRes = await ordenesService.listar();
    const todas = "results" in ordenesRes.data ? ordenesRes.data.results : ordenesRes.data;
    const ordenesAbiertas = todas.filter((o) => o.estado === "abierta");

    let caja: CajaSesion;
    try {
        ({ data: caja } = await cajaService.obtenerEstado());
    } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
            return { ordenesAbiertas, caja: null, movimientos: [], pagos: [] };
        }
        throw err;
    }

    const [movRes, pagRes] = await Promise.all([
        cajaService.listarMovimientos(),
        cajaService.listarPagos(),
    ]);
    return {
        ordenesAbiertas,
        caja,
        movimientos: "results" in movRes.data ? movRes.data.results : movRes.data,
        pagos: "results" in pagRes.data ? pagRes.data.results : pagRes.data,
    };
}

export default function useCaja() {
    const [caja, setCaja] = useState<CajaSesion | null>(null);
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [pagos, setPagos] = useState<Pago[]>([]);
    const [ordenesAbiertas, setOrdenesAbiertas] = useState<Orden[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const esAdmin = authService.hasRole("admin");

    // Todos los setState van dentro de callbacks de la promesa, asi el
    // efecto de montaje no actualiza estado de forma sincrona
    // (react-hooks/set-state-in-effect).
    const obtenerEstado = useCallback(() =>
        fetchEstadoCaja()
            .then((estado) => {
                setOrdenesAbiertas(estado.ordenesAbiertas);
                setCaja(estado.caja);
                setMovimientos(estado.movimientos);
                setPagos(estado.pagos);
                setError(null);
            })
            .catch(() => setError("Error al cargar el estado de caja."))
            .finally(() => setCargando(false)),
    []);

    const cargarEstado = useCallback(() => {
        setCargando(true);
        return obtenerEstado();
    }, [obtenerEstado]);

    // Polling liviano: solo recarga órdenes abiertas cada 5 segundos.
    // Mantiene la lista del cajero actualizada sin recargar pagos/movimientos.
    // Patrón idéntico al setInterval de OrdenesPage.jsx.
    const actualizarOrdenesAbiertas = useCallback(async () => {
        try {
            const ordenesRes = await ordenesService.listar();
            const todas = "results" in ordenesRes.data ? ordenesRes.data.results : ordenesRes.data;
            setOrdenesAbiertas(todas.filter((o) => o.estado === "abierta"));
        } catch { /* silencioso — no interrumpe el estado actual */ }
    }, []);

    useEffect(() => {
        obtenerEstado();
        const iv = setInterval(actualizarOrdenesAbiertas, 5000);
        return () => clearInterval(iv);
    }, [obtenerEstado, actualizarOrdenesAbiertas]);

    return {
        caja, movimientos, pagos, ordenesAbiertas,
        cargando, error, esAdmin, recargar: cargarEstado,
    };
}
