import { useEffect, useRef, type ReactNode, type FormEvent, type MouseEvent } from "react";
import { AlertTriangle, X } from "lucide-react";

// ─── Base del modal ───────────────────────────────────────────────────────────
// En el celular sube desde abajo como una hoja (al alcance del pulgar, como
// en una app). En tablet y computadora es un cuadro centrado.
interface ModalBaseProps {
  children: ReactNode;
  onClose?: () => void;
  maxWidth?: string;
  etiqueta?: string;
}

function ModalBase({ children, onClose, maxWidth = "420px", etiqueta }: ModalBaseProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Los que usan el modal suelen pasar onClose como flecha nueva en cada
  // render: se guarda en un ref para que el efecto corra una sola vez (si no,
  // el foco saltaria al panel cada vez que el usuario escribe en un campo).
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onCloseRef.current?.(); };
    document.addEventListener("keydown", handler);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previo = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = overflow;
      previo?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-espresso/40 backdrop-blur-[2px] sm:p-6 animate-in fade-in-0 duration-150"
      onClick={(e: MouseEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta}
        tabIndex={-1}
        className="flex w-full flex-col overflow-hidden bg-marfil shadow-alta outline-none rounded-t-3xl sm:rounded-2xl max-h-[92dvh] sm:max-h-[calc(100dvh-48px)] animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-2 sm:zoom-in-95 duration-200"
        style={{ maxWidth }}
      >
        <div className="sm:hidden mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-linea-fuerte" aria-hidden />
        {children}
      </div>
    </div>
  );
}

function Cabecera({ titulo, onCerrar }: { titulo?: string; onCerrar?: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-linea px-5 sm:px-6 py-3.5 sm:py-4">
      <h3 className="font-display text-lg font-semibold text-espresso leading-tight">{titulo}</h3>
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        className="grid size-9 shrink-0 place-items-center rounded-full text-suave hover:bg-arena transition-colors"
      >
        <X className="size-4.5" />
      </button>
    </div>
  );
}

const btnSecundario =
  "flex-1 h-12 sm:h-11 rounded-xl border border-linea-fuerte bg-marfil text-[15px] sm:text-sm font-semibold text-espresso hover:bg-arena transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
const btnPrimario =
  "flex-1 h-12 sm:h-11 rounded-xl text-[15px] sm:text-sm font-semibold text-marfil transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

function Pie({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex shrink-0 gap-3 border-t border-linea px-5 sm:px-6 pt-3.5 sm:py-4"
      style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}
    >
      {children}
    </div>
  );
}

type Variante = "danger" | "warning" | "primary";

interface ConfirmDialogProps {
  abierto: boolean;
  titulo?: string;
  descripcion?: string;
  textoOk?: string;
  textoCancelar?: string;
  variante?: Variante;
  cargando?: boolean;
  onConfirmar?: () => void;
  onCancelar?: () => void;
}

const VARIANTES: Record<Variante, { boton: string; icono: string }> = {
  danger: { boton: "bg-peligro hover:bg-peligro/90", icono: "bg-peligro-fondo text-peligro" },
  warning: { boton: "bg-aviso hover:bg-aviso/90", icono: "bg-aviso-fondo text-aviso" },
  primary: { boton: "bg-salvia hover:bg-salvia-osc", icono: "bg-salvia-clara text-salvia-osc" },
};

export function ConfirmDialog({
  abierto,
  titulo,
  descripcion,
  textoOk = "Confirmar",
  textoCancelar = "Cancelar",
  variante = "danger",
  cargando = false,
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  if (!abierto) return null;
  const v = VARIANTES[variante] ?? VARIANTES.danger;

  return (
    <ModalBase onClose={onCancelar} maxWidth="400px" etiqueta={titulo}>
      <div className="px-6 pt-6 pb-2 text-center">
        <div className={`mx-auto mb-4 grid size-13 place-items-center rounded-full ${v.icono}`}>
          <AlertTriangle className="size-6" strokeWidth={1.8} />
        </div>
        <h3 className="font-display text-lg font-semibold text-espresso">{titulo}</h3>
        {descripcion && (
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-suave">{descripcion}</p>
        )}
      </div>
      <Pie>
        <button type="button" onClick={onCancelar} disabled={cargando} className={btnSecundario}>
          {textoCancelar}
        </button>
        <button type="button" onClick={onConfirmar} disabled={cargando} className={`${btnPrimario} ${v.boton}`}>
          {cargando ? "Procesando…" : textoOk}
        </button>
      </Pie>
    </ModalBase>
  );
}

interface FormModalProps {
  abierto: boolean;
  titulo?: string;
  onCerrar?: () => void;
  onGuardar?: () => void;
  cargando?: boolean;
  textoGuardar?: string;
  maxWidth?: string;
  children: ReactNode;
}

export function FormModal({
  abierto,
  titulo,
  onCerrar,
  onGuardar,
  cargando = false,
  textoGuardar = "Guardar",
  maxWidth = "480px",
  children,
}: FormModalProps) {
  if (!abierto) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onGuardar?.();
  };

  return (
    <ModalBase onClose={onCerrar} maxWidth={maxWidth} etiqueta={titulo}>
      <Cabecera titulo={titulo} onCerrar={onCerrar} />
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 sm:px-6 py-5">
          {children}
        </div>
        <Pie>
          <button type="button" onClick={onCerrar} disabled={cargando} className={btnSecundario}>
            Cancelar
          </button>
          <button type="submit" disabled={cargando} className={`${btnPrimario} bg-salvia hover:bg-salvia-osc`}>
            {cargando ? "Guardando…" : textoGuardar}
          </button>
        </Pie>
      </form>
    </ModalBase>
  );
}

interface DetailModalProps {
  abierto: boolean;
  titulo?: string;
  onCerrar?: () => void;
  maxWidth?: string;
  children: ReactNode;
}

export function DetailModal({ abierto, titulo, onCerrar, maxWidth = "480px", children }: DetailModalProps) {
  if (!abierto) return null;

  return (
    <ModalBase onClose={onCerrar} maxWidth={maxWidth} etiqueta={titulo}>
      <Cabecera titulo={titulo} onCerrar={onCerrar} />
      <div
        className="flex min-h-0 flex-col gap-3 overflow-y-auto px-5 sm:px-6 pt-5"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
      >
        {children}
      </div>
    </ModalBase>
  );
}
