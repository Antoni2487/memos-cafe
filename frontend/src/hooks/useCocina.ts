import { useCallback, useEffect, useRef, useState } from "react";
import comandasService from "../services/comandasService";
import useStaffSocket, { type StaffSocketStatus } from "./useStaffSocket";
import { getErrorMessage } from "../utils/errors";
import { sonarAviso } from "../utils/sonido";
import type { ComandaCocina } from "../types";

/** Comanda con sus momentos pasados al reloj de este dispositivo (ms). */
export interface ComandaTablero extends ComandaCocina {
  desde: { creada: number; iniciada: number | null; lista: number | null };
}

// Los segundos los mide el servidor; se restan a "ahora" en este
// dispositivo, así los cronómetros no dependen de que su reloj esté bien.
function alReloj(c: ComandaCocina): ComandaTablero {
  const ahora = Date.now();
  const hace = (seg: number | null) => (seg === null ? null : ahora - seg * 1000);
  return {
    ...c,
    desde: {
      creada: ahora - c.segundos.desde_creada * 1000,
      iniciada: hace(c.segundos.desde_iniciada),
      lista: hace(c.segundos.desde_lista),
    },
  };
}

const POLL_MS = 30000; // red de seguridad además del WebSocket
const CLAVE_SONIDO = "cocina_sonido";

/**
 * Tablero de Cocina por comanda. Suena una vez por cada comanda nueva
 * (no por cada ítem), llegue por WebSocket o por la consulta de respaldo.
 */
export function useCocina() {
  const [comandas, setComandas] = useState<ComandaTablero[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sonido, setSonidoState] = useState(() => localStorage.getItem(CLAVE_SONIDO) !== "no");
  const cargandoRef = useRef(false);
  const pendienteRef = useRef(false);
  const conocidas = useRef<Set<number> | null>(null);
  const sonidoRef = useRef(sonido);
  useEffect(() => { sonidoRef.current = sonido; }, [sonido]);

  const repetirRef = useRef<() => void>(() => {});
  const cargar = useCallback(() => {
    // Si llegan varios eventos seguidos, se hace una consulta y a lo sumo
    // una más al terminar (con lo último), nunca en paralelo.
    if (cargandoRef.current) {
      pendienteRef.current = true;
      return;
    }
    cargandoRef.current = true;
    comandasService
      .tablero()
      .then(({ data }) => {
        const nuevas = conocidas.current ? data.filter((c) => !conocidas.current!.has(c.id)) : [];
        if (nuevas.length && sonidoRef.current) sonarAviso();
        conocidas.current = new Set(data.map((c) => c.id));
        setComandas(data.map(alReloj));
        setError(null);
      })
      .catch((err) => setError(getErrorMessage(err, "No se pudo cargar el tablero de cocina")))
      .finally(() => {
        cargandoRef.current = false;
        setCargando(false);
        if (pendienteRef.current) {
          pendienteRef.current = false;
          repetirRef.current();
        }
      });
  }, []);

  useEffect(() => { repetirRef.current = cargar; }, [cargar]);

  useEffect(() => {
    cargar();
    const iv = setInterval(cargar, POLL_MS);
    const alVolver = () => document.visibilityState === "visible" && cargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cargar]);

  const status: StaffSocketStatus = useStaffSocket("cocina", cargar);

  // Cada acción devuelve la comanda actualizada: se reemplaza en el tablero
  // sin esperar la próxima consulta (y se quita si ya se entregó).
  const aplicar = useCallback(async (accion: () => Promise<{ data: ComandaCocina }>) => {
    try {
      const { data } = await accion();
      conocidas.current?.add(data.id);
      const actualizada = alReloj(data);
      setComandas((prev) =>
        prev.map((c) => (c.id === data.id ? actualizada : c)).filter((c) => c.estado !== "entregada")
      );
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo actualizar la comanda"));
      cargar();
    }
  }, [cargar]);

  const setSonido = useCallback((v: boolean) => {
    setSonidoState(v);
    try { localStorage.setItem(CLAVE_SONIDO, v ? "si" : "no"); } catch { /* sin almacenamiento */ }
  }, []);

  return {
    comandas, cargando, error, status, recargar: cargar, sonido, setSonido,
    iniciar: (id: number) => aplicar(() => comandasService.iniciar(id)),
    marcarItem: (id: number, detalleId: number, listo: boolean) => aplicar(() => comandasService.marcarItem(id, detalleId, listo)),
    marcarLista: (id: number) => aplicar(() => comandasService.lista(id)),
    entregar: (id: number) => aplicar(() => comandasService.entregar(id)),
  };
}

export default useCocina;
