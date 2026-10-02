import { useState } from "react";
import {
  AlertCircle, BellRing, Check, ChefHat, CreditCard, Flower2, HandPlatter, Receipt, ShoppingBag, Trash2, Wallet,
} from "lucide-react";
import Hoja from "./Hoja";
import { Contador } from "./FichaProducto";
import { soles, type PedidoMesa } from "./usePedidoMesa";
import type { ComandaQR, DetalleQR, EstadoComanda, PedidoPorConfirmarQR } from "../../types";

const METODOS = [
  { value: "efectivo", label: "Efectivo", icono: Wallet },
  { value: "tarjeta", label: "Tarjeta", icono: CreditCard },
  { value: "yape", label: "Yape", icono: Receipt },
  { value: "plin", label: "Plin", icono: Receipt },
];

const PASOS: { estado: EstadoComanda; label: string; icono: typeof Check }[] = [
  { estado: "pendiente", label: "Recibido", icono: Check },
  { estado: "en_preparacion", label: "Preparando", icono: ChefHat },
  { estado: "lista", label: "Listo", icono: BellRing },
  { estado: "entregada", label: "Servido", icono: HandPlatter },
];

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-PE", { hour: "numeric", minute: "2-digit" });

export default function MiPedido({
  pedido, onEnviar, onVerCarta,
}: { pedido: PedidoMesa; onEnviar: () => void; onVerCarta: () => void }) {
  const { carrito, orden, porConfirmar, visitaTerminada } = pedido;
  const hayAlgo = carrito.length > 0 || orden || porConfirmar;

  return (
    <div className="flex flex-col gap-5 px-5 pb-8" style={{ paddingTop: "max(20px, env(safe-area-inset-top))" }}>
      <h1 className="font-display text-[28px] font-semibold text-espresso">Mi pedido</h1>

      {pedido.error && (
        <p role="alert" className="flex items-start gap-2 rounded-2xl bg-peligro-fondo px-4 py-3 text-sm text-peligro">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="flex-1">{pedido.error}</span>
        </p>
      )}

      {visitaTerminada && !orden && carrito.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-salvia-clara px-6 py-8 text-center">
          <Flower2 className="size-8 text-salvia-osc" strokeWidth={1.5} />
          <p className="font-display text-xl font-semibold text-espresso">¡Gracias por tu visita!</p>
          <p className="text-sm text-suave">Esperamos que lo hayas disfrutado. Vuelve pronto.</p>
        </div>
      )}

      {carrito.length > 0 && <PorEnviar pedido={pedido} onEnviar={onEnviar} />}

      {porConfirmar && !orden && <EstadoPrimerPedido pedido={porConfirmar} />}

      {orden && orden.detalles.length > 0 && <Rondas pedido={pedido} />}

      {!hayAlgo && !visitaTerminada && (
        <div className="flex flex-col items-center gap-3 py-14 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-arena text-suave">
            <ShoppingBag className="size-7" strokeWidth={1.5} />
          </span>
          <p className="font-display text-xl font-semibold text-espresso">Todavía no pediste nada</p>
          <p className="max-w-xs text-sm text-suave">Elige en la carta lo que se te antoje y envíalo desde aquí.</p>
          <button type="button" onClick={onVerCarta} className="mt-2 h-12 rounded-2xl bg-salvia px-6 font-semibold text-marfil">
            Ver la carta
          </button>
        </div>
      )}
    </div>
  );
}

function PorEnviar({ pedido, onEnviar }: { pedido: PedidoMesa; onEnviar: () => void }) {
  const { carrito, totalCarrito, cambiarCantidad, quitar, enviando, orden, porConfirmar } = pedido;
  const esperando = porConfirmar?.estado === "pendiente";

  return (
    <section aria-labelledby="por-enviar" className="rounded-3xl border border-linea bg-marfil p-4 shadow-suave">
      <h2 id="por-enviar" className="mb-1 text-[15px] font-semibold text-espresso">
        {orden || esperando ? "Para agregar a tu pedido" : "Tu pedido"}
      </h2>
      <ul className="divide-y divide-linea">
        {carrito.map((i) => (
          <li key={i.key} className="flex items-center gap-3 py-3">
            {i.imagen ? (
              <img src={i.imagen} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-salvia-clara font-display text-xl text-salvia/60">
                {i.nombre.charAt(0)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-espresso">{i.nombre}</p>
              {i.nota && <p className="truncate text-sm italic text-suave">"{i.nota}"</p>}
              <p className="text-sm text-suave tabular-nums">{soles(i.precio * i.cantidad)}</p>
            </div>
            {i.cantidad === 1 ? (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => quitar(i.key)} aria-label={`Quitar ${i.nombre}`} className="grid size-9 place-items-center rounded-full text-tenue active:bg-arena">
                  <Trash2 className="size-4" />
                </button>
                <Contador valor={1} min={0} compacto onCambiar={(v) => cambiarCantidad(i.key, v - 1)} />
              </div>
            ) : (
              <Contador valor={i.cantidad} min={0} compacto onCambiar={(v) => cambiarCantidad(i.key, v - i.cantidad)} />
            )}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onEnviar}
        disabled={enviando}
        className="mt-4 flex h-13 w-full items-center justify-between rounded-2xl bg-salvia px-5 text-[15px] font-semibold text-marfil transition-colors active:bg-salvia-osc disabled:opacity-60"
      >
        <span>{enviando ? "Enviando…" : "Enviar pedido"}</span>
        <span className="tabular-nums">{soles(totalCarrito)}</span>
      </button>
    </section>
  );
}

function EstadoPrimerPedido({ pedido }: { pedido: PedidoPorConfirmarQR }) {
  if (pedido.estado === "confirmado") return null;
  const textos = {
    pendiente: {
      titulo: "Recibimos tu pedido",
      detalle: "En un momento pasa a cocina.",
      tono: "bg-aviso-fondo text-aviso",
    },
    rechazado: {
      titulo: "No pudimos tomar tu pedido",
      detalle: "Llama a tu mesero y lo resuelven al toque. También puedes volver a enviarlo.",
      tono: "bg-peligro-fondo text-peligro",
    },
    expirado: {
      titulo: "Tu pedido no llegó a cocina",
      detalle: "Lo sentimos. Vuelve a enviarlo o llama a tu mesero.",
      tono: "bg-peligro-fondo text-peligro",
    },
  }[pedido.estado];

  return (
    <section className="overflow-hidden rounded-3xl border border-linea bg-marfil shadow-suave">
      <div className={`flex items-start gap-3 px-4 py-4 ${textos.tono}`}>
        {pedido.estado === "pendiente" ? (
          <span className="relative mt-1 flex size-3 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-50" />
            <span className="relative inline-flex size-3 rounded-full bg-current" />
          </span>
        ) : (
          <AlertCircle className="mt-0.5 size-5 shrink-0" />
        )}
        <div>
          <p className="font-semibold">{textos.titulo}</p>
          <p className="mt-0.5 text-sm opacity-90">{textos.detalle}</p>
        </div>
      </div>
      {pedido.estado === "pendiente" && (
        <ul className="divide-y divide-linea px-4">
          {pedido.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-3 py-3 text-[15px]">
              <span className="min-w-0 text-espresso">
                {i.cantidad} × {i.nombre}
                {i.nota && <span className="block text-sm italic text-suave">"{i.nota}"</span>}
              </span>
              <span className="shrink-0 text-suave tabular-nums">{soles(Number(i.precio) * i.cantidad)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Rondas({ pedido }: { pedido: PedidoMesa }) {
  const orden = pedido.orden!;
  const [cobro, setCobro] = useState(false);
  const porRonda = new Map<number, DetalleQR[]>();
  for (const d of orden.detalles) {
    if (!porRonda.has(d.ronda)) porRonda.set(d.ronda, []);
    porRonda.get(d.ronda)!.push(d);
  }
  const comandas: ComandaQR[] = orden.comandas.length
    ? orden.comandas
    : [...porRonda.keys()].map((n) => ({ numero: n, origen: "qr", estado: "pendiente", creada_en: "" }));

  return (
    <>
      {[...comandas].reverse().map((c) => (
        <section key={c.numero} className="rounded-3xl border border-linea bg-marfil p-4 shadow-suave">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-espresso">
              {comandas.length > 1 ? `Ronda ${c.numero}` : "Tu pedido"}
            </h2>
            {c.creada_en && <span className="text-sm text-tenue">{hora(c.creada_en)}</span>}
          </div>
          <Progreso estado={c.estado} />
          <ul className="mt-3 divide-y divide-linea">
            {(porRonda.get(c.numero) ?? []).map((d) => (
              <li key={d.id} className="flex justify-between gap-3 py-2.5 text-[15px]">
                <span className="min-w-0 text-espresso">
                  {d.cantidad} × {d.nombre}
                  {d.nota && <span className="block text-sm italic text-suave">"{d.nota}"</span>}
                </span>
                <span className="shrink-0 text-suave tabular-nums">{soles(d.subtotal)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section className="rounded-3xl bg-arena/70 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] text-suave">Total hasta ahora</span>
          <span className="font-display text-2xl font-semibold text-espresso tabular-nums">{soles(orden.total)}</span>
        </div>
        {orden.cuenta_solicitada ? (
          <p className="mt-3 flex items-center gap-2 rounded-2xl bg-salvia-clara px-4 py-3 text-sm font-medium text-salvia-osc">
            <Check className="size-4 shrink-0" />
            Ya le avisamos a tu mesero. En un momento se acerca con la cuenta.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setCobro(true)}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-linea-fuerte bg-marfil text-[15px] font-semibold text-espresso active:bg-beige"
          >
            <Receipt className="size-4.5" />
            Pedir la cuenta
          </button>
        )}
      </section>

      {cobro && <PedirCuenta pedido={pedido} onCerrar={() => setCobro(false)} />}
    </>
  );
}

function Progreso({ estado }: { estado: EstadoComanda }) {
  const actual = PASOS.findIndex((p) => p.estado === estado);
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label={`Estado: ${PASOS[actual]?.label}`}>
      {PASOS.map((p, n) => {
        const hecho = n <= actual;
        const Icono = p.icono;
        return (
          <li key={p.estado} className="flex flex-col items-center gap-1.5">
            <span className={`h-1.5 w-full rounded-full ${hecho ? "bg-salvia" : "bg-linea"}`} />
            <span className={`flex items-center gap-1 text-xs ${n === actual ? "font-semibold text-salvia-osc" : hecho ? "text-suave" : "text-tenue"}`}>
              {n === actual && <Icono className="size-3.5" />}
              {p.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function PedirCuenta({ pedido, onCerrar }: { pedido: PedidoMesa; onCerrar: () => void }) {
  const [metodo, setMetodo] = useState("efectivo");
  const [enviando, setEnviando] = useState(false);

  return (
    <Hoja etiqueta="Pedir la cuenta" onCerrar={onCerrar}>
      <h2 className="pr-10 font-display text-2xl font-semibold text-espresso">¿Cómo vas a pagar?</h2>
      <p className="mt-1 text-sm text-suave">Le avisamos a tu mesero para que venga con la cuenta.</p>
      <div className="mt-5 grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Método de pago">
        {METODOS.map(({ value, label, icono: Icono }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={metodo === value}
            onClick={() => setMetodo(value)}
            className={`flex h-16 items-center gap-3 rounded-2xl border px-4 text-[15px] font-medium transition-colors ${
              metodo === value ? "border-salvia bg-salvia-clara text-salvia-osc" : "border-linea bg-beige text-espresso"
            }`}
          >
            <Icono className="size-5" strokeWidth={1.7} />
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={enviando}
        onClick={async () => {
          setEnviando(true);
          const ok = await pedido.pedirCuenta(metodo);
          setEnviando(false);
          if (ok) onCerrar();
        }}
        className="mt-6 h-13 w-full rounded-2xl bg-salvia text-[15px] font-semibold text-marfil disabled:opacity-60"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        {enviando ? "Avisando…" : `Pedir la cuenta · ${soles(pedido.orden?.total ?? 0)}`}
      </button>
    </Hoja>
  );
}
