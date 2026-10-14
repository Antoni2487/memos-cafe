import { useCallback, useEffect, useRef, useState } from "react";

/** Lo que tarda en irse una ventana o una hoja (más corto que su entrada). */
export const SALIDA_MS = 160;

export const movimientoReducido = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Mantiene algo en pantalla mientras hace su animación de salida. Con
 * `abierto` en false, `saliendo` queda en true durante `ms` y después
 * `montado` pasa a false.
 */
export function usePresencia(abierto: boolean, ms = SALIDA_MS) {
  const [montado, setMontado] = useState(abierto);
  if (abierto && !montado) setMontado(true);

  useEffect(() => {
    if (abierto || !montado) return;
    const t = setTimeout(() => setMontado(false), movimientoReducido() ? 0 : ms);
    return () => clearTimeout(t);
  }, [abierto, montado, ms]);

  return { montado, saliendo: montado && !abierto };
}

/**
 * Para lo que se cierra a sí mismo (una hoja con su X): `cerrar()` arranca
 * la animación de salida y recién al terminar llama a `alTerminar`.
 */
export function useSalida(alTerminar: () => void, ms = SALIDA_MS) {
  const [saliendo, setSaliendo] = useState(false);
  const alTerminarRef = useRef(alTerminar);
  useEffect(() => { alTerminarRef.current = alTerminar; }, [alTerminar]);

  useEffect(() => {
    if (!saliendo) return;
    const t = setTimeout(() => alTerminarRef.current(), movimientoReducido() ? 0 : ms);
    return () => clearTimeout(t);
  }, [saliendo, ms]);

  const cerrar = useCallback(() => setSaliendo(true), []);
  return { saliendo, cerrar };
}
