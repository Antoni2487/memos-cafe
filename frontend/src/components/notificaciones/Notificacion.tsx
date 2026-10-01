import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Check } from "lucide-react";

export type Urgencia = "normal" | "atencion" | "urgente";

export interface AccionNotificacion {
  etiqueta: string;
  onClick: () => void;
  primaria?: boolean;
  /** Si es true, la notificación sale con animación antes de ejecutar la acción. */
  cierra?: boolean;
  ariaLabel?: string;
}

interface Props {
  /** Ícono de la "app" que avisa (cuadrado redondeado, como en el celular). */
  icono: ReactNode;
  colorIcono?: "salvia" | "champan";
  origen: string;
  hora: string;
  urgencia?: Urgencia;
  titulo: ReactNode;
  etiqueta?: string;
  children?: ReactNode;
  pie?: ReactNode;
  acciones: AccionNotificacion[];
  /** Deslizar a la derecha ejecuta esta acción (además del botón). */
  deslizar?: { etiqueta: string; accion: () => void };
  ocupada?: boolean;
  ariaLabel: string;
}

const UMBRAL = 0.35; // fracción del ancho para confirmar el deslizamiento
const SALIDA_MS = 260;

const movimientoReducido = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Una notificación con el lenguaje de las del celular: ícono de la app,
 * origen y hora arriba, título en negrita, el mensaje, y las acciones abajo
 * como en las alertas del teléfono. Opcionalmente se desliza a la derecha
 * para la acción principal (como archivar un correo).
 */
export default function Notificacion({
  icono, colorIcono = "salvia", origen, hora, urgencia = "normal", titulo, etiqueta,
  children, pie, acciones, deslizar, ocupada = false, ariaLabel,
}: Props) {
  const tarjeta = useRef<HTMLElement>(null);
  const gesto = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null);
  const evitarClick = useRef(false);
  const [dx, setDx] = useState(0);
  const [arrastrando, setArrastrando] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const salirY = (accion: () => void) => {
    if (movimientoReducido()) return accion();
    setSaliendo(true);
    temporizador.current = setTimeout(() => {
      accion();
      // Normalmente la notificación ya se desmontó. Si sigue acá (la acción
      // falló y el aviso se mantiene), vuelve a verse.
      temporizador.current = setTimeout(() => { setSaliendo(false); setDx(0); }, 1500);
    }, SALIDA_MS);
  };

  const alPresionar = (e: PointerEvent<HTMLElement>) => {
    if (!deslizar || ocupada || e.button !== 0) return;
    gesto.current = { x: e.clientX, y: e.clientY, horizontal: null };
  };

  const alMover = (e: PointerEvent<HTMLElement>) => {
    const g = gesto.current;
    if (!g) return;
    const ddx = e.clientX - g.x;
    const ddy = e.clientY - g.y;
    if (g.horizontal === null) {
      if (Math.hypot(ddx, ddy) < 8) return;
      // Si el dedo va más vertical que horizontal, es scroll: no se toca.
      g.horizontal = Math.abs(ddx) > Math.abs(ddy);
      if (!g.horizontal) { gesto.current = null; return; }
      e.currentTarget.setPointerCapture(e.pointerId);
      setArrastrando(true);
    }
    setDx(Math.max(0, ddx));
  };

  const alSoltar = () => {
    const g = gesto.current;
    gesto.current = null;
    if (!g?.horizontal) return;
    evitarClick.current = true;
    setArrastrando(false);
    const ancho = tarjeta.current?.offsetWidth ?? 1;
    if (deslizar && dx > ancho * UMBRAL) {
      salirY(deslizar.accion);
    } else {
      setDx(0);
    }
  };

  const progreso = Math.min(1, dx / 96);
  const transformacion = saliendo ? "translateX(110%)" : `translateX(${dx}px)`;

  return (
    <div className="notif-entrar relative">
      {deslizar && (
        // Lo que aparece detrás al deslizar, como en el correo del teléfono.
        <div
          aria-hidden
          className="absolute inset-0 flex items-center gap-2 rounded-[22px] bg-exito pl-5 text-[15px] font-semibold text-marfil"
          style={{ opacity: saliendo ? 1 : progreso }}
        >
          <Check className="size-5" strokeWidth={2.6} style={{ transform: `scale(${0.6 + progreso * 0.4})` }} />
          {deslizar.etiqueta}
        </div>
      )}
      <article
        ref={tarjeta}
        aria-label={ariaLabel}
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onClickCapture={(e) => {
          if (evitarClick.current) { e.stopPropagation(); evitarClick.current = false; }
        }}
        className="relative overflow-hidden rounded-[22px] border border-linea/80 bg-marfil shadow-alta select-none"
        style={{
          transform: transformacion,
          opacity: saliendo ? 0 : 1,
          transition: arrastrando ? "none" : `transform ${SALIDA_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${SALIDA_MS}ms ease`,
          touchAction: deslizar ? "pan-y" : undefined,
        }}
      >
        <div className="flex gap-3 px-3.5 pt-3 pb-3">
          <span
            aria-hidden
            className={`grid size-10 shrink-0 place-items-center rounded-[11px] text-marfil shadow-suave ${
              colorIcono === "champan" ? "bg-champan" : "bg-salvia"
            }`}
          >
            {icono}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[12px] leading-none text-suave">
              <span className="font-semibold uppercase tracking-[0.06em]">{origen}</span>
              <span className="ml-auto flex items-center gap-1.5 tabular-nums">
                {urgencia !== "normal" && (
                  <span
                    aria-hidden
                    className={`size-2 rounded-full ${urgencia === "urgente" ? "animate-pulse bg-peligro" : "bg-aviso"}`}
                  />
                )}
                <span className={urgencia === "urgente" ? "font-semibold text-peligro" : urgencia === "atencion" ? "font-semibold text-aviso" : ""}>
                  {hora}
                </span>
              </span>
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] font-semibold leading-snug text-espresso">
              {titulo}
              {etiqueta && (
                <span className="rounded-full bg-salvia-clara px-2 py-px text-[11px] font-bold uppercase tracking-wide text-salvia-osc">
                  {etiqueta}
                </span>
              )}
            </p>
            {children && <div className="mt-0.5 text-[14.5px] leading-snug text-espresso/85">{children}</div>}
            {pie && <p className="mt-1 text-[12.5px] text-suave">{pie}</p>}
          </div>
        </div>

        {/* Acciones como en las alertas del teléfono: a lo ancho, separadas
            por una línea fina, con área de toque generosa. */}
        <div className="flex border-t border-linea/80">
          {acciones.map((a, i) => (
            <button
              key={a.etiqueta}
              type="button"
              disabled={ocupada}
              aria-label={a.ariaLabel}
              onClick={() => (a.cierra ? salirY(a.onClick) : a.onClick())}
              className={`h-12 flex-1 text-[15px] transition-colors active:bg-arena disabled:opacity-50 ${
                i > 0 ? "border-l border-linea/80" : ""
              } ${a.primaria ? "font-semibold text-salvia-osc" : "font-medium text-suave"}`}
            >
              {a.etiqueta}
            </button>
          ))}
        </div>
      </article>
    </div>
  );
}
