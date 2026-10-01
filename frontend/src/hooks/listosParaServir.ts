import { useSyncExternalStore } from "react";
import type { ComandaCocina } from "../types";

// Lista compartida de "listo para servir": la llena ListosParaServir (que
// escucha el tiempo real) y la leen las pestañas del menú para mostrar el
// contador sin volver a consultar al servidor.
let listas: ComandaCocina[] = [];
const oyentes = new Set<() => void>();

export function guardarListas(nuevas: ComandaCocina[]) {
  listas = nuevas;
  oyentes.forEach((o) => o());
}

function suscribir(oyente: () => void) {
  oyentes.add(oyente);
  return () => { oyentes.delete(oyente); };
}

export function useListosParaServir(): ComandaCocina[] {
  return useSyncExternalStore(suscribir, () => listas);
}
