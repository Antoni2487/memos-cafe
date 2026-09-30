import { useCallback, useEffect, useRef, useState } from "react";
import ordenesService from "../services/ordenesService";
import useStaffSocket, { type StaffSocketStatus } from "./useStaffSocket";
import { getErrorMessage } from "../utils/errors";
import type { EstadoPreparacion, TicketCocina } from "../types";

const POLL_MS = 60000; // red de seguridad además del WebSocket (ver notas de diseño)

export function useCocina() {
  const [tickets, setTickets] = useState<TicketCocina[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cargandoRef = useRef(false);

  // setState solo dentro de callbacks de la promesa
  // (react-hooks/set-state-in-effect). cargandoRef evita pedidos solapados
  // cuando llegan varios eventos del WebSocket seguidos.
  const cargar = useCallback(() => {
    if (cargandoRef.current) return Promise.resolve();
    cargandoRef.current = true;
    return ordenesService
      .cocina()
      .then(({ data }) => {
        setTickets(data);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err, "No se pudo cargar el tablero de cocina")))
      .finally(() => {
        cargandoRef.current = false;
        setCargando(false);
      });
  }, []);

  useEffect(() => {
    cargar();
    const iv = setInterval(cargar, POLL_MS);
    return () => clearInterval(iv);
  }, [cargar]);

  // Cualquier evento del canal (pedido nuevo o cambio de estado) es señal
  // de "algo cambió" — se re-consulta el tablero completo en vez de
  // parchear localmente: los eventos son poco frecuentes en una cafetería
  // real, así que la simplicidad de un refetch gana sobre la ganancia
  // marginal de un patch fino, que además no puede armar un ticket nuevo
  // completo (nombre, ronda, etc.) sólo con el payload del WebSocket.
  const manejarEvento = useCallback(() => {
    cargar();
  }, [cargar]);

  const status: StaffSocketStatus = useStaffSocket("cocina", manejarEvento);

  const avanzarEstado = useCallback(
    async (ordenId: number, detalleId: number, estado: EstadoPreparacion) => {
      const { data } = await ordenesService.actualizarEstadoPreparacion(ordenId, detalleId, estado);
      setTickets((prev) => {
        const sinItemsEntregados = data.detalles.length > 0;
        if (!sinItemsEntregados) {
          return prev.filter((t) => t.id !== data.id);
        }
        return prev.map((t) => (t.id === data.id ? data : t));
      });
    },
    []
  );

  return { tickets, cargando, error, status, avanzarEstado, recargar: cargar };
}

export default useCocina;
