import { useEffect, useState } from "react";

const MS_VISIBLE = 1500;
const MS_SALIDA = 400;

/**
 * Saludo al escanear el QR: el logo y "Bienvenido a la Mesa N" por un
 * instante, y la carta aparece debajo con un fundido. Se toca para saltarlo.
 * PedidoQRPage decide si mostrarlo (una vez por mesa y sesión, y nunca con
 * movimiento reducido).
 */
export default function Bienvenida({ mesaNumero, onFin }: { mesaNumero: number | null; onFin: () => void }) {
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSaliendo(true), MS_VISIBLE);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!saliendo) return;
    const t = setTimeout(onFin, MS_SALIDA);
    return () => clearTimeout(t);
  }, [saliendo, onFin]);

  return (
    <div
      role="status"
      onClick={() => setSaliendo(true)}
      className={`fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-beige px-8 text-center transition-opacity ease-in ${
        saliendo ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      style={{ transitionDuration: `${MS_SALIDA}ms` }}
    >
      <img
        src="/logo-memos.png"
        alt=""
        className="size-24 rounded-full shadow-alta animate-in fade-in-0 zoom-in-75 duration-500 ease-out"
      />
      <div className="animate-in fade-in-0 slide-in-from-bottom-3 fill-mode-both delay-200 duration-500 ease-out">
        <p className="font-display text-[28px] font-semibold leading-tight text-espresso">
          {mesaNumero !== null ? `Bienvenido a la Mesa ${mesaNumero}` : "Bienvenido a Memo's"}
        </p>
        <p className="mt-1 font-display text-base italic text-suave">Tu carta está lista, pide sin esperar</p>
      </div>
      <span className="mt-2 flex gap-1.5" aria-hidden>
        {[0, 150, 300].map((d) => (
          <span key={d} className="size-2 animate-pulse rounded-full bg-salvia" style={{ animationDelay: `${d}ms` }} />
        ))}
      </span>
    </div>
  );
}
