import { useEffect, useRef, type RefObject } from "react";

const MS_VUELO = 600;

/**
 * Miniatura del producto que "vuela" desde su foto hasta el contador de la
 * barra del carrito (con un pequeño arco). Es solo decorativa: el carrito ya
 * se actualizó antes de que empiece.
 */
export default function VueloAlCarrito({
  src,
  desde,
  hacia,
  onFin,
}: {
  src: string;
  desde: DOMRect;
  hacia: RefObject<HTMLElement | null>;
  onFin: () => void;
}) {
  const img = useRef<HTMLImageElement>(null);
  const finRef = useRef(onFin);
  useEffect(() => { finRef.current = onFin; }, [onFin]);

  useEffect(() => {
    const destino = hacia.current?.getBoundingClientRect();
    const el = img.current;
    if (!destino || !el || typeof el.animate !== "function") {
      finRef.current();
      return;
    }
    const tam = Math.min(desde.width, desde.height, 96);
    const x0 = desde.left + desde.width / 2 - tam / 2;
    const y0 = desde.top + desde.height / 2 - tam / 2;
    const dx = destino.left + destino.width / 2 - (x0 + tam / 2);
    const dy = destino.top + destino.height / 2 - (y0 + tam / 2);
    el.style.left = `${x0}px`;
    el.style.top = `${y0}px`;
    el.style.width = el.style.height = `${tam}px`;

    const animacion = el.animate(
      [
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
        { transform: `translate(${dx * 0.55}px, ${dy * 0.35 - 60}px) scale(0.7)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0.4 },
      ],
      { duration: MS_VUELO, easing: "cubic-bezier(0.4, 0, 0.2, 1)", fill: "forwards" }
    );
    animacion.onfinish = () => finRef.current();
    return () => animacion.cancel();
  }, [desde, hacia]);

  return (
    <img
      ref={img}
      src={src}
      alt=""
      aria-hidden
      className="pointer-events-none fixed z-[55] rounded-full object-cover shadow-alta ring-3 ring-marfil"
    />
  );
}
