import type { CSSProperties } from "react";
import type { GeometriaPlano } from "../../../types";

/** Posición de una pieza (centro, tamaño y giro) en % del lienzo. */
export function estiloPieza(g: GeometriaPlano, ancho: number, alto: number): CSSProperties {
  const x = g.plano_x ?? ancho / 2;
  const y = g.plano_y ?? alto / 2;
  return {
    position: "absolute",
    left: `${((x - g.plano_ancho / 2) / ancho) * 100}%`,
    top: `${((y - g.plano_alto / 2) / alto) * 100}%`,
    width: `${(g.plano_ancho / ancho) * 100}%`,
    height: `${(g.plano_alto / alto) * 100}%`,
    transform: g.rotacion ? `rotate(${g.rotacion}deg)` : undefined,
  };
}

/** Tamaño de letra en unidades del plano, con mínimo legible en celular. */
export const letra = (unidades: number, minimoPx = 10) => `max(${minimoPx}px, calc(var(--u) * ${unidades}))`;
