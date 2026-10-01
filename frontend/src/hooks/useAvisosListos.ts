import { useCallback, useEffect, useRef, useState } from "react";
import comandasService from "../services/comandasService";
import useStaffSocket from "./useStaffSocket";
import { useReloj } from "./useReloj";
import { guardarListas, obtenerListas, useListosParaServir } from "./listosParaServir";
import { sonarTimbre } from "../utils/sonido";
import type { ComandaCocina } from "../types";

const POLL_MS = 20000; // respaldo si el tiempo real no está disponible
export const RECORDAR_SEG = 2 * 60;
export const URGENTE_SEG = 5 * 60;

/** 0: recién salida · 1: ya pasó el recordatorio · 2: urgente */
export const nivelDeEspera = (seg: number) => (seg >= URGENTE_SEG ? 2 : seg >= RECORDAR_SEG ? 1 : 0);

/**
 * Datos y comportamiento de los avisos "listo para servir": carga desde el
 * servidor (no se pierden al recargar), escucha el tiempo real, suena el
 * timbre al llegar uno nuevo y lo recuerda a los 2 y 5 minutos. "servir"
 * es optimista: lo quita al instante y, si el servidor falla, vuelve.
 */
export default function useAvisosListos(habilitado: boolean) {
  const listas = useListosParaServir();
  const ahora = useReloj().getTime();
  const [cargadoEn, setCargadoEn] = useState(() => Date.now());
  const [error, setError] = useState<string | null>(null);
  // Hasta qué nivel ya sonó cada comanda.
  const avisadas = useRef<Map<number, number> | null>(null);

  const cargar = useCallback(() => {
    comandasService
      .listas()
      .then(({ data }) => {
        const antes = avisadas.current;
        const despues = new Map<number, number>();
        let nueva = false;
        for (const c of data) {
          const previo = antes?.get(c.id);
          if (previo !== undefined) {
            despues.set(c.id, previo);
          } else if (antes) {
            nueva = true;
            despues.set(c.id, 0);
          } else {
            // Primera carga (o se recargó la página): no suena todo de golpe.
            despues.set(c.id, nivelDeEspera(c.segundos.desde_lista ?? 0));
          }
        }
        avisadas.current = despues;
        setCargadoEn(Date.now());
        guardarListas(data);
        if (nueva) sonarTimbre();
      })
      .catch(() => { /* silencioso: se reintenta */ });
  }, []);

  useEffect(() => {
    if (!habilitado) return;
    cargar();
    const iv = setInterval(cargar, POLL_MS);
    return () => clearInterval(iv);
  }, [habilitado, cargar]);

  useStaffSocket(
    "meseros",
    (evento) => {
      if (evento.type === "comanda.actualizada") cargar();
    },
    habilitado
  );

  const esperaDe = useCallback(
    (c: ComandaCocina) => (c.segundos.desde_lista ?? 0) + Math.max(0, Math.floor((ahora - cargadoEn) / 1000)),
    [ahora, cargadoEn]
  );

  // Recordatorio: vuelve a sonar una vez al cruzar los 2 y los 5 minutos.
  useEffect(() => {
    const mapa = avisadas.current;
    if (!mapa) return;
    let sonar = false;
    for (const c of listas) {
      const debe = nivelDeEspera(esperaDe(c));
      if (debe > (mapa.get(c.id) ?? 0)) {
        mapa.set(c.id, debe);
        sonar = true;
      }
    }
    if (sonar) sonarTimbre();
  }, [listas, esperaDe]);

  // El aviso de error se va solo.
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);

  const servir = useCallback(
    async (c: ComandaCocina, nombre: string) => {
      guardarListas(obtenerListas().filter((x) => x.id !== c.id));
      try {
        await comandasService.entregar(c.id);
      } catch {
        setError(`No se pudo marcar ${nombre} como servida. Volvió a la lista.`);
        cargar();
      }
    },
    [cargar]
  );

  return { listas, esperaDe, servir, error };
}
