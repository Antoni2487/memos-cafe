import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BookOpen, Flower2, ShoppingBag, WifiOff, type LucideIcon } from "lucide-react";
import CartaCliente from "./CartaCliente";
import MiPedido from "./MiPedido";
import ConoceMemos from "./ConoceMemos";
import { soles, usePedidoMesa } from "./usePedidoMesa";

type Pestana = "carta" | "pedido" | "conoce";

/**
 * Lo que ve el cliente al escanear el QR de su mesa: una app de tres
 * pestañas (Carta, Mi pedido, Conoce Memo's). Sin login. Lo ya pedido vive
 * en el servidor: si pierde el enlace, vuelve a escanear y ahí está todo.
 */
export default function PedidoQRPage() {
  const { codigo = "" } = useParams<{ codigo: string }>();
  const pedido = usePedidoMesa(codigo);
  const [pestana, setPestana] = useState<Pestana>("carta");
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [pestana]);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  // El theme-color de la barra del navegador acompaña a la portada.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const antes = meta?.getAttribute("content");
    meta?.setAttribute("content", "#F5F0E6");
    return () => { if (antes) meta?.setAttribute("content", antes); };
  }, []);

  if (pedido.cargando) {
    return (
      <main className="grid min-h-dvh place-items-center bg-beige">
        <img src="/logo-memos.png" alt="Cargando" className="size-20 animate-pulse rounded-full" />
      </main>
    );
  }

  if (pedido.mesaInexistente) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-beige px-8 text-center">
        <img src="/logo-memos.png" alt="" className="mb-2 size-16 rounded-full opacity-80" />
        <h1 className="font-display text-2xl font-semibold text-espresso">No encontramos esta mesa</h1>
        <p className="max-w-xs text-[15px] text-suave">
          Vuelve a escanear el código QR de tu mesa. Si sigue sin funcionar, avísale a tu mesero.
        </p>
      </main>
    );
  }

  const enviar = async () => {
    const r = await pedido.enviar();
    if (r === "orden") setAviso("¡Listo! Tu pedido ya está en cocina.");
    if (r === "por_confirmar") setAviso("Enviado. Tu mesero lo confirmará en un momento.");
  };

  const activo = pedido.orden !== null || pedido.porConfirmar?.estado === "pendiente";

  return (
    <div className="min-h-dvh bg-beige" style={{ paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }}>
      {pedido.sinConexion && (
        <p className="fixed inset-x-0 top-0 z-40 flex items-center justify-center gap-2 bg-espresso px-4 py-2 text-sm text-marfil" style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}>
          <WifiOff className="size-4" /> Sin conexión. Reintentando…
        </p>
      )}

      <div className="mx-auto w-full max-w-lg">
        {pestana === "carta" && <CartaCliente pedido={pedido} />}
        {pestana === "pedido" && <MiPedido pedido={pedido} onEnviar={enviar} onVerCarta={() => setPestana("carta")} />}
        {pestana === "conoce" && <ConoceMemos onVerCarta={() => setPestana("carta")} />}
      </div>

      {/* Barra del carrito: aparece en la carta apenas eliges algo */}
      {pestana === "carta" && pedido.cantidadCarrito > 0 && (
        <div className="fixed inset-x-0 z-30 mx-auto max-w-lg px-4" style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}>
          <button
            type="button"
            onClick={() => setPestana("pedido")}
            className="flex h-14 w-full items-center gap-3 rounded-2xl bg-salvia pl-3 pr-5 text-marfil shadow-alta animate-in slide-in-from-bottom-4 duration-200 active:bg-salvia-osc"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-marfil/15 text-sm font-bold tabular-nums">
              {pedido.cantidadCarrito}
            </span>
            <span className="flex-1 text-left text-[15px] font-semibold">Ver mi pedido</span>
            <span className="text-[15px] font-semibold tabular-nums">{soles(pedido.totalCarrito)}</span>
          </button>
        </div>
      )}

      {aviso && (
        <div role="status" className="fixed inset-x-0 top-4 z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-espresso px-5 py-3 text-sm font-medium text-marfil shadow-alta animate-in fade-in-0 slide-in-from-top-2">
          {aviso}
        </div>
      )}

      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-linea bg-marfil/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex h-18 max-w-lg items-stretch">
          <Tab icono={BookOpen} label="Carta" activa={pestana === "carta"} onClick={() => setPestana("carta")} />
          <Tab
            icono={ShoppingBag}
            label="Mi pedido"
            activa={pestana === "pedido"}
            onClick={() => setPestana("pedido")}
            contador={pedido.cantidadCarrito}
            punto={activo && pedido.cantidadCarrito === 0}
          />
          <Tab icono={Flower2} label="Conoce Memo's" activa={pestana === "conoce"} onClick={() => setPestana("conoce")} />
        </ul>
      </nav>
    </div>
  );
}

function Tab({
  icono: Icono, label, activa, onClick, contador = 0, punto = false,
}: {
  icono: LucideIcon; label: string; activa: boolean; onClick: () => void; contador?: number; punto?: boolean;
}) {
  return (
    <li className="flex-1">
      <button
        type="button"
        onClick={onClick}
        aria-current={activa ? "page" : undefined}
        className="flex h-full w-full flex-col items-center justify-center gap-1"
      >
        <span className={`relative grid h-8 w-16 place-items-center rounded-full transition-colors ${activa ? "bg-salvia-clara text-salvia-osc" : "text-suave"}`}>
          <Icono className="size-5.5" strokeWidth={activa ? 2.1 : 1.8} />
          {contador > 0 && (
            <span className="absolute -top-1 right-2 grid h-5 min-w-5 place-items-center rounded-full bg-salvia px-1 text-[11px] font-bold text-marfil ring-2 ring-marfil tabular-nums">
              {contador}
            </span>
          )}
          {punto && <span className="absolute top-0.5 right-4 size-2.5 rounded-full bg-champan ring-2 ring-marfil" aria-label="Pedido en curso" />}
        </span>
        <span className={`text-xs ${activa ? "font-semibold text-salvia-osc" : "text-suave"}`}>{label}</span>
      </button>
    </li>
  );
}
