import { useEffect, useRef, useState } from "react";
import { movimientoReducido } from "../../utils/movimiento";

const MS_MINI = 3200;

function Puntos({ total, activa, grande = false }: { total: number; activa: number; grande?: boolean }) {
  return (
    <span className={`pointer-events-none absolute inset-x-0 flex justify-center gap-1 ${grande ? "bottom-3" : "bottom-1.5"}`} aria-hidden>
      {Array.from({ length: total }, (_, n) => (
        <span
          key={n}
          className={`rounded-full bg-marfil shadow-suave transition-[width,opacity] duration-300 ease-out ${grande ? "h-1.5" : "h-1"} ${
            n === activa ? (grande ? "w-5" : "w-3") : `${grande ? "w-1.5" : "w-1"} opacity-60`
          }`}
        />
      ))}
    </span>
  );
}

/**
 * Las fotos de un producto en el cuadradito de la carta: van cambiando solas
 * (fundido) mientras el cuadradito está en pantalla. No se desliza a mano
 * para que tocarlo siga abriendo la ficha.
 */
export function MiniGaleria({ fotos, retrasoMs = 0 }: { fotos: string[]; retrasoMs?: number }) {
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(false);
  const caja = useRef<HTMLSpanElement>(null);
  const variasFotos = fotos.length > 1;

  useEffect(() => {
    if (!variasFotos || !caja.current) return;
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.6 });
    obs.observe(caja.current);
    return () => obs.disconnect();
  }, [variasFotos]);

  useEffect(() => {
    if (!visible || movimientoReducido()) return;
    let iv: ReturnType<typeof setInterval> | undefined;
    // Desfase por tarjeta: que no cambien todas a la vez.
    const t = setTimeout(() => {
      setI((x) => (x + 1) % fotos.length);
      iv = setInterval(() => setI((x) => (x + 1) % fotos.length), MS_MINI);
    }, MS_MINI + retrasoMs);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [visible, fotos.length, retrasoMs]);

  return (
    <span ref={caja} className="relative block size-24 overflow-hidden rounded-2xl bg-arena">
      {fotos.map((src, n) => (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          className={`absolute inset-0 size-full object-cover transition-[opacity,transform] duration-700 ease-out ${
            n === i ? "scale-100 opacity-100" : "scale-105 opacity-0"
          }`}
        />
      ))}
      {variasFotos && <Puntos total={fotos.length} activa={i} />}
    </span>
  );
}

/**
 * Galería de la ficha: se desliza con el dedo (scroll-snap nativo) y los
 * puntos siguen a la foto visible; tocar un punto lleva a esa foto.
 */
export function GaleriaGrande({ fotos, nombre }: { fotos: string[]; nombre: string }) {
  const [i, setI] = useState(0);
  const pista = useRef<HTMLDivElement>(null);

  const alDeslizar = () => {
    const el = pista.current;
    if (!el) return;
    setI(Math.round(el.scrollLeft / el.clientWidth));
  };

  const irA = (n: number) => {
    const el = pista.current;
    el?.scrollTo({ left: n * el.clientWidth, behavior: movimientoReducido() ? "auto" : "smooth" });
  };

  return (
    <div className="relative" role="group" aria-roledescription="carrusel" aria-label={`Fotos de ${nombre}`}>
      <div
        ref={pista}
        onScroll={alDeslizar}
        className="flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {fotos.map((src, n) => (
          <img
            key={src}
            src={src}
            alt={`${nombre}, foto ${n + 1} de ${fotos.length}`}
            className="size-full shrink-0 snap-center object-cover"
            loading={n === 0 ? "eager" : "lazy"}
          />
        ))}
      </div>
      <Puntos total={fotos.length} activa={i} grande />
      {/* Botones accesibles (los puntos de arriba son solo visuales) */}
      <div className="absolute inset-x-0 bottom-0 flex h-9 justify-center gap-1 opacity-0 focus-within:opacity-100">
        {fotos.map((src, n) => (
          <button key={src} type="button" onClick={() => irA(n)} aria-label={`Ver foto ${n + 1}`} className="w-6" />
        ))}
      </div>
    </div>
  );
}
