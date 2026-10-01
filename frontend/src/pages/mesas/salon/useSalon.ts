import { useCallback, useEffect, useRef, useState } from "react";
import mesasService from "../../../services/mesasService";
import useStaffSocket from "../../../hooks/useStaffSocket";
import { getErrorMessage } from "../../../utils/errors";
import type { Plano } from "../../../types";

const POLL_MS = 15000; // respaldo: no todos los cambios llegan por el canal de meseros

// Eventos del canal de meseros que cambian algo del salón.
const EVENTOS = new Set([
  "pedido.por_confirmar",
  "pedido.por_confirmar_resuelto",
  "comanda.actualizada",
  "solicitud_cobro.nueva",
  "detalle.actualizado",
]);

/** El croquis con lo que pasa en cada mesa, actualizado en vivo. */
export function useSalon(activo = true) {
  const [plano, setPlano] = useState<Plano | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const enCurso = useRef(false);

  const cargar = useCallback(() => {
    if (enCurso.current) return Promise.resolve();
    enCurso.current = true;
    return mesasService
      .plano()
      .then(({ data }) => {
        setPlano(data);
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err, "No se pudo cargar el salón")))
      .finally(() => {
        enCurso.current = false;
        setCargando(false);
      });
  }, []);

  useEffect(() => {
    if (!activo) return;
    cargar();
    const iv = setInterval(() => document.visibilityState === "visible" && cargar(), POLL_MS);
    const alVolver = () => document.visibilityState === "visible" && cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [activo, cargar]);

  useStaffSocket(
    "meseros",
    (evento) => {
      if (EVENTOS.has(String(evento.type))) cargar();
    },
    activo
  );

  return { plano, setPlano, cargando, error, recargar: cargar };
}
