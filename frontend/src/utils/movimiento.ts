/** El usuario pidió menos animaciones en su sistema (accesibilidad). */
export const movimientoReducido = (): boolean =>
  typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
