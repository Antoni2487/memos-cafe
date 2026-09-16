import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import cajaService from "../services/cajaService";
import ordenesService from "../services/ordenesService";
import authService from "../services/authService";
import type { CajaSesion, Movimiento, Orden, Pago } from "../types";

export default function useCaja() {
    const [caja, setCaja] = useState<CajaSesion | null>(null);
    const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
    const [pagos, setPagos] = useState<Pago[]>([]);
    const [ordenesAbiertas, setOrdenesAbiertas] = useState<Orden[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const esAdmin = authService.hasRole("admin");

    const cargarEstado = useCallback(async () => {
        try {
            setCargando(true);
            setError(null);

            const ordenesRes = await ordenesService.listar();
            const todas = "results" in ordenesRes.data ? ordenesRes.data.results : ordenesRes.data;
            setOrdenesAbiertas(todas.filter((o) => o.estado === "abierta"));

            const { data } = await cajaService.obtenerEstado();
            setCaja(data);

            const [movRes, pagRes] = await Promise.all([
                cajaService.listarMovimientos(),
                cajaService.listarPagos(),
            ]);
            setMovimientos("results" in movRes.data ? movRes.data.results : movRes.data);
            setPagos("results" in pagRes.data ? pagRes.data.results : pagRes.data);
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 404) {
                setCaja(null);
                setMovimientos([]);
                setPagos([]);
            } else {
                setError("Error al cargar el estado de caja.");
            }
        } finally {
            setCargando(false);
        }
    }, []);

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
        cargarEstado();
        const iv = setInterval(actualizarOrdenesAbiertas, 5000);
        return () => clearInterval(iv);
    }, [cargarEstado, actualizarOrdenesAbiertas]);

    return {
        caja, movimientos, pagos, ordenesAbiertas,
        cargando, error, esAdmin, recargar: cargarEstado,
    };
}
