import { useEffect, useRef, useState } from "react";
import { movimientoReducido } from "../utils/movimiento";

// Curva ease-out (token curva/salida): arranca rápido y frena al llegar.
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Número que "cuenta" hasta `objetivo` (los KPI del panel). Si el valor
 * cambia, sigue contando desde donde iba. Con movimiento reducido salta
 * directo al valor final.
 */
export function useContador(objetivo: number, duracionMs = 800): number {
  const [valor, setValor] = useState(() => (movimientoReducido() ? objetivo : 0));
  const desde = useRef(valor);

  useEffect(() => {
    if (movimientoReducido()) {
      const id = requestAnimationFrame(() => setValor(objetivo));
      return () => cancelAnimationFrame(id);
    }
    const inicio = performance.now();
    const origen = desde.current;
    let id = 0;
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / duracionMs);
      const actual = origen + (objetivo - origen) * easeOut(t);
      desde.current = actual;
      setValor(actual);
      if (t < 1) id = requestAnimationFrame(paso);
    };
    id = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(id);
  }, [objetivo, duracionMs]);

  return valor;
}

/**
 * `false` en el primer render y `true` en el cuadro siguiente: sirve para
 * que barras y anchos arranquen en 0 y la transición CSS los haga crecer.
 */
export function useMontado(): boolean {
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return montado;
}
