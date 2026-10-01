import { forwardRef, type CSSProperties, type ReactNode, type PointerEvent } from "react";
import type { ElementoPlano } from "../../../types";
import { estiloPieza, letra } from "./geometria";

/**
 * Lienzo del croquis: un rectángulo de ancho×alto unidades del plano que se
 * escala al ancho disponible (tablet, celular o computadora se ven igual).
 * Todo adentro se posiciona en %, y los textos escalan con el lienzo
 * (--u = una unidad del plano en px, con un mínimo legible).
 */
export const Lienzo = forwardRef<HTMLDivElement, {
  ancho: number;
  alto: number;
  children: ReactNode;
  cuadricula?: boolean;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
}>(function Lienzo({ ancho, alto, children, cuadricula, onPointerDown }, ref) {
  return (
    <div className="@container w-full">
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        className="relative w-full overflow-hidden rounded-3xl border border-linea bg-marfil select-none touch-none"
        style={{
          aspectRatio: `${ancho} / ${alto}`,
          ["--u" as string]: `calc(100cqw / ${ancho})`,
          backgroundImage: cuadricula
            ? "radial-gradient(circle, color-mix(in oklab, var(--linea-fuerte) 80%, transparent) 1px, transparent 1.2px)"
            : undefined,
          backgroundSize: cuadricula ? `calc(100% / ${ancho / 20}) calc(100% / ${alto / 20})` : undefined,
        } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
});

/** Barra, pared, entrada o texto. Solo orientan, no tienen estado. */
export function Elemento({ el, ancho, alto, seleccionado, onPointerDown }: {
  el: ElementoPlano;
  ancho: number;
  alto: number;
  seleccionado?: boolean;
  onPointerDown?: (e: PointerEvent<HTMLDivElement>) => void;
}) {
  const vertical = el.plano_alto > el.plano_ancho * 1.6;
  const base = estiloPieza(el, ancho, alto);
  const anillo = seleccionado ? "ring-3 ring-salvia ring-offset-2 ring-offset-marfil" : "";
  const editable = onPointerDown ? "cursor-grab active:cursor-grabbing" : "";

  if (el.tipo === "pared") {
    return <div style={base} onPointerDown={onPointerDown} className={`rounded-full bg-espresso/55 ${anillo} ${editable}`} />;
  }
  const texto = el.etiqueta || (el.tipo === "barra" ? "Barra" : el.tipo === "entrada" ? "Entrada" : "Texto");
  const estilos = {
    barra: "bg-arena border-2 border-linea-fuerte text-suave",
    entrada: "border-2 border-dashed border-champan/60 text-champan bg-champan-claro/40",
    texto: "text-suave",
  }[el.tipo];
  return (
    <div
      style={base}
      onPointerDown={onPointerDown}
      className={`grid place-items-center overflow-hidden ${el.forma === "redonda" ? "rounded-[50%]" : "rounded-2xl"} ${estilos} ${anillo} ${editable}`}
    >
      <span
        className="font-semibold uppercase tracking-[0.2em]"
        style={{ fontSize: letra(el.tipo === "texto" ? 18 : 16), writingMode: vertical ? "vertical-rl" : undefined }}
      >
        {texto}
      </span>
    </div>
  );
}
