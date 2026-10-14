import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useSalida } from "../../hooks/usePresencia";

/**
 * Hoja que sube desde abajo (en pantallas grandes, cuadro centrado). Se
 * cierra tocando afuera, con la X o con Escape, y bloquea el scroll de atrás.
 * Al cerrarse vuelve a bajar: el cliente ve que volvió a la carta, no que
 * algo desapareció. Si el contenido necesita cerrarla (el botón "Agregar"),
 * children puede ser una función que recibe `cerrar`.
 */
export default function Hoja({
  etiqueta,
  onCerrar,
  children,
  sinRelleno = false,
}: {
  etiqueta: string;
  onCerrar: () => void;
  children: ReactNode | ((cerrar: () => void) => ReactNode);
  sinRelleno?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const { saliendo, cerrar } = useSalida(onCerrar);
  const cerrarRef = useRef(cerrar);
  useEffect(() => { cerrarRef.current = cerrar; }, [cerrar]);

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
      <div
        className={`absolute inset-0 bg-espresso/45 ${
          saliendo ? "animate-out fade-out-0 duration-160 ease-entrada fill-mode-forwards" : "animate-in fade-in-0 duration-160 ease-salida"
        }`}
        onClick={cerrar}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={etiqueta}
        tabIndex={-1}
        inert={saliendo}
        className={`relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-marfil shadow-alta outline-none sm:rounded-3xl ${
          saliendo
            ? "animate-out slide-out-to-bottom-full sm:slide-out-to-bottom-4 sm:fade-out-0 duration-160 ease-entrada fill-mode-forwards"
            : "animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-4 sm:fade-in-0 duration-240 ease-salida"
        }`}
      >
        <button
          type="button"
          onClick={cerrar}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-marfil/90 text-espresso shadow-suave backdrop-blur"
        >
          <X className="size-5" />
        </button>
        <div className={`min-h-0 flex-1 overflow-y-auto ${sinRelleno ? "" : "px-5 pb-5 pt-6"}`}>{typeof children === "function" ? children(cerrar) : children}</div>
      </div>
    </div>
  );
}
