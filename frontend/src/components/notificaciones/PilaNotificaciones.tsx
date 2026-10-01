import { Children, useState, type ReactNode } from "react";

interface Props {
  titulo: string;
  children: ReactNode;
}

const ASOMAN = 2; // cuántas se ven "detrás" cuando la pila está cerrada

/**
 * Agrupa notificaciones como el centro de notificaciones del iPhone: se ve
 * la primera y las demás asoman detrás. Al tocar la pila se despliega.
 */
export default function PilaNotificaciones({ titulo, children }: Props) {
  const items = Children.toArray(children);
  const [abierta, setAbierta] = useState(false);
  if (items.length === 0) return null;

  const varias = items.length > 1;
  const detras = Math.min(ASOMAN, items.length - 1);

  return (
    <section aria-label={titulo} className="flex flex-col gap-2">
      {varias && (
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[13px] font-semibold text-espresso">
            {titulo} <span className="font-normal text-suave">· {items.length}</span>
          </h2>
          <button
            type="button"
            onClick={() => setAbierta((v) => !v)}
            aria-expanded={abierta}
            className="h-7 rounded-full bg-arena px-3 text-[12px] font-semibold text-espresso hover:bg-linea"
          >
            {abierta ? "Mostrar menos" : `Ver las ${items.length}`}
          </button>
        </div>
      )}

      {abierta || !varias ? (
        <div className="flex flex-col gap-2">{items}</div>
      ) : (
        <div className="relative" style={{ marginBottom: detras * 7 }}>
          <div className="relative z-10">{items[0]}</div>
          {Array.from({ length: detras }, (_, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              aria-hidden
              onClick={() => setAbierta(true)}
              className="absolute inset-x-0 h-full rounded-[22px] border border-linea/80 bg-marfil/80 shadow-suave"
              style={{
                bottom: -(i + 1) * 7,
                transform: `scale(${1 - (i + 1) * 0.04})`,
                zIndex: 9 - i,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
