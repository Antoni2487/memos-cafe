import type { FotoProducto } from "../types";

/** Mismo tope que MAX_FOTOS_POR_PRODUCTO en productos/services.py. */
export const MAX_FOTOS = 6;

/** Portada primero y después las fotos adicionales, sin huecos. */
export function galeriaDe(item: { imagen?: string | null; fotos?: FotoProducto[] }): string[] {
  return [item.imagen, ...(item.fotos ?? []).map((f) => f.imagen)].filter((src): src is string => Boolean(src));
}
