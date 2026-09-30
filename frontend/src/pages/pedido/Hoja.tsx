import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Hoja que sube desde abajo (en pantallas grandes, cuadro centrado). Se
 * cierra tocando afuera, con la X o con Escape, y bloquea el scroll de atrás.
 */
export default function Hoja({
  etiqueta,
  onCerrar,
  children,
  sinRelleno = false,
}: {
  etiqueta: string;
  onCerrar: () => void;
  children: ReactNode;
  sinRelleno?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef(onCerrar);
  useEffect(() => { cerrarRef.current = onCerrar; }, [onCerrar]);

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && cerrarRef.current();
    document.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
      previo?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-espresso/45 animate-in fade-in-0 duration-150" onClick={onCerrar} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta}
        tabIndex={-1}
        className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-marfil shadow-alta outline-none animate-in slide-in-from-bottom-10 duration-200 sm:rounded-3xl"
      >
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-marfil/90 text-espresso shadow-suave backdrop-blur"
        >
          <X className="size-5" />
        </button>
        <div className={`min-h-0 flex-1 overflow-y-auto ${sinRelleno ? "" : "px-5 pb-5 pt-6"}`}>{children}</div>
      </div>
    </div>
  );
}
