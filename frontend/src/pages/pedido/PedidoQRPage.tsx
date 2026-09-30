import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Plus, Minus, ShoppingBag, Receipt, Loader2, Coffee } from "lucide-react";
import pedidoQRService from "../../services/pedidoQRService";
import productoService from "../../services/productoService";
import promocionService from "../../services/promocionService";
import { getErrorMessage } from "../../utils/errors";
import { StatusBadge } from "../../components/common";
import type { Producto, Promocion, OrdenQR } from "../../types";

const POLL_MS = 10000;

const METODOS_PAGO = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "yape", label: "Yape" },
  { value: "plin", label: "Plin" },
];

interface ItemCarrito {
  key: string;
  productoId?: number;
  promocionId?: number;
  nombre: string;
  precio: number;
  cantidad: number;
}

function precioNum(p: number | string): number {
  return typeof p === "number" ? p : parseFloat(p);
}

// ─── Tarjeta de producto/promoción del catálogo ────────────────────────────
function ItemCatalogo({
  nombre, precio, imagen, esPromo, onAgregar,
}: {
  nombre: string;
  precio: number | string;
  imagen?: string | null;
  esPromo?: boolean;
  onAgregar: () => void;
}) {
  return (
    <button
      onClick={onAgregar}
      className="flex w-full flex-col items-start gap-1 overflow-hidden rounded-xl border border-brand/15 bg-white p-2.5 text-left shadow-card transition active:scale-[0.98]"
    >
      {imagen ? (
        <img src={imagen} alt={nombre} className="h-20 w-full rounded-lg object-cover" />
      ) : (
        <div
          className={`flex h-20 w-full items-center justify-center rounded-lg font-display text-xl font-bold ${
            esPromo ? "bg-gold/15 text-gold" : "bg-brand/10 text-brand"
          }`}
        >
          {nombre.charAt(0).toUpperCase()}
        </div>
      )}
      {esPromo && (
        <span className="font-body text-[10px] font-bold uppercase tracking-wide text-gold">Promo</span>
      )}
      <span className="font-body text-[13px] font-semibold leading-tight text-brand">{nombre}</span>
      <span className="font-body text-sm font-bold text-brand">S/ {precioNum(precio).toFixed(2)}</span>
    </button>
  );
}

export default function PedidoQRPage() {
  const { codigo = "" } = useParams<{ codigo: string }>();

  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [mesaInexistente, setMesaInexistente] = useState(false);
  const [sesionActiva, setSesionActiva] = useState(false);
  const [mesaNumero, setMesaNumero] = useState<number | null>(null);
  const [ordenActual, setOrdenActual] = useState<OrdenQR | null>(null);
  const [tuvoSesionActiva, setTuvoSesionActiva] = useState(false);

  const [productos, setProductos] = useState<Producto[]>([]);
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  // Si la carta ya se pidio (o esta en camino). Ref y no estado: no cambia lo
  // que se ve, solo evita pedirla dos veces.
  const catalogoPedido = useRef(false);

  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<"productos" | "promociones">("productos");
  const [busqueda, setBusqueda] = useState("");
  const [categFiltro, setCategFiltro] = useState("todos");

  const [mostrarCobro, setMostrarCobro] = useState(false);
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [enviandoCobro, setEnviandoCobro] = useState(false);
  const [cobroSolicitado, setCobroSolicitado] = useState(false);

  // La carta se pide una sola vez, recien cuando la mesa esta abierta. Si
  // falla, se reintenta en la siguiente consulta de estado (POLL_MS).
  const cargarCatalogo = useCallback(() => {
    catalogoPedido.current = true;
    Promise.all([productoService.listarPublico(), promocionService.listarPublico()])
      .then(([listaProductos, listaPromociones]) => {
        setProductos(listaProductos);
        setPromociones(listaPromociones);
      })
      .catch(() => {
        catalogoPedido.current = false;
      });
  }, []);

  // Todos los setState van dentro de callbacks de la promesa
  // (react-hooks/set-state-in-effect).
  const cargarEstado = useCallback(
    () =>
      pedidoQRService
        .estado(codigo)
        .then(({ data }) => {
          setSesionActiva(data.sesion_activa);
          setMesaNumero(data.mesa_numero);
          setOrdenActual(data.orden);
          if (data.sesion_activa) setTuvoSesionActiva(true);
          setMesaInexistente(false);
          if (data.sesion_activa && !catalogoPedido.current) cargarCatalogo();
        })
        .catch((err) => {
          if (axios.isAxiosError(err) && err.response?.status === 404) {
            setMesaInexistente(true);
          }
        })
        .finally(() => setCargandoInicial(false)),
    [codigo, cargarCatalogo]
  );

  useEffect(() => {
    cargarEstado();
    const iv = setInterval(cargarEstado, POLL_MS);
    return () => clearInterval(iv);
  }, [cargarEstado]);

  const agregarAlCarrito = (item: Producto | Promocion, esPromo: boolean) => {
    const key = `${esPromo ? "promo" : "prod"}-${item.id}`;
    setCarrito((prev) => {
      const existente = prev.find((i) => i.key === key);
      if (existente) {
        return prev.map((i) => (i.key === key ? { ...i, cantidad: i.cantidad + 1 } : i));
      }
      return [
        ...prev,
        {
          key,
          productoId: esPromo ? undefined : item.id,
          promocionId: esPromo ? item.id : undefined,
          nombre: item.nombre,
          precio: precioNum(item.precio),
          cantidad: 1,
        },
      ];
    });
    setCarritoAbierto(true);
  };

  const cambiarCantidad = (key: string, delta: number) => {
    setCarrito((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, cantidad: i.cantidad + delta } : i))
        .filter((i) => i.cantidad > 0)
    );
  };

  const totalCarrito = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const cantidadCarrito = carrito.reduce((s, i) => s + i.cantidad, 0);

  const confirmarPedido = async () => {
    if (carrito.length === 0) return;
    setEnviando(true);
    setError(null);
    try {
      const { data } = await pedidoQRService.pedir(
        codigo,
        carrito.map((i) => ({
          producto: i.productoId ?? null,
          promocion: i.promocionId ?? null,
          cantidad: i.cantidad,
        }))
      );
      setOrdenActual(data);
      setCarrito([]);
      setCarritoAbierto(false);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo enviar el pedido. Intentalo de nuevo."));
    } finally {
      setEnviando(false);
    }
  };

  const solicitarCobro = async () => {
    setEnviandoCobro(true);
    setError(null);
    try {
      await pedidoQRService.solicitarCobro(codigo, metodoPago);
      setCobroSolicitado(true);
      setMostrarCobro(false);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo pedir la cuenta. Intentalo de nuevo."));
    } finally {
      setEnviandoCobro(false);
    }
  };

  const categorias = [
    "todos",
    ...new Set(productos.map((p) => p.categoria_nombre).filter((c): c is string => Boolean(c))),
  ];
  const termino = busqueda.trim().toLowerCase();
  const productosFiltrados = productos.filter(
    (p) => (categFiltro === "todos" || p.categoria_nombre === categFiltro) &&
      (!termino || p.nombre.toLowerCase().includes(termino))
  );
  const promocionesFiltradas = promociones.filter(
    (p) => !termino || p.nombre.toLowerCase().includes(termino)
  );

  // ── Pantallas de estado (sin sesión, mesa inexistente, cargando) ─────────
  if (cargandoInicial) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <Loader2 className="animate-spin text-brand" size={28} />
      </div>
    );
  }

  if (mesaInexistente) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-6 text-center">
        <Coffee className="text-brand/40" size={40} />
        <p className="font-display text-lg font-semibold text-brand">Mesa no encontrada</p>
        <p className="font-body text-sm text-brand/60">Revisá el código QR de tu mesa e intentá de nuevo.</p>
      </div>
    );
  }

  if (!sesionActiva) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-cream px-6 text-center">
        <Coffee className="text-brand/40" size={40} />
        {tuvoSesionActiva ? (
          <>
            <p className="font-display text-lg font-semibold text-brand">¡Gracias por tu visita!</p>
            <p className="font-body text-sm text-brand/60">Esperamos que hayas disfrutado tu pedido en Memo's Café.</p>
          </>
        ) : (
          <>
            <p className="font-display text-lg font-semibold text-brand">Todavía no podés pedir</p>
            <p className="font-body text-sm text-brand/60">Pedile a tu mesero que abra la mesa para pedir por acá.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-28">
      <header className="sticky top-0 z-20 bg-brand px-4 py-3.5 shadow-card">
        <p className="font-display text-lg font-semibold text-white">Mesa {mesaNumero} · Memo's Café</p>
      </header>

      <main className="flex flex-col gap-5 px-4 py-4">
        {error && (
          <div className="rounded-lg bg-red-50 px-3 py-2.5 font-body text-sm text-red-700">{error}</div>
        )}

        {ordenActual && ordenActual.detalles.length > 0 && (
          <section className="flex flex-col gap-2 rounded-xl bg-white p-3.5 shadow-card">
            <p className="font-display text-sm font-semibold text-brand">Tu pedido</p>
            {ordenActual.detalles.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-2 border-b border-brand/8 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-body text-[13px] font-medium text-brand truncate">
                    {d.cantidad}x {d.nombre}
                  </p>
                </div>
                <StatusBadge estado={d.estado_preparacion} size="sm" />
              </div>
            ))}
            <div className="flex items-center justify-between pt-1">
              <span className="font-body text-xs text-brand/60">Total pedido hasta ahora</span>
              <span className="font-body text-sm font-bold text-brand">S/ {precioNum(ordenActual.total).toFixed(2)}</span>
            </div>
            {!cobroSolicitado ? (
              <button
                onClick={() => setMostrarCobro((v) => !v)}
                className="mt-1 flex items-center justify-center gap-1.5 rounded-lg border border-gold/50 bg-gold/10 py-2 font-body text-xs font-semibold text-gold"
              >
                <Receipt size={14} /> Pedir la cuenta
              </button>
            ) : (
              <p className="mt-1 text-center font-body text-xs font-medium text-brand/70">
                Ya avisamos a tu mesero — en un momento se acerca a cobrar.
              </p>
            )}
            {mostrarCobro && !cobroSolicitado && (
              <div className="mt-1 flex flex-col gap-2 rounded-lg bg-cream p-2.5">
                <p className="font-body text-xs text-brand/70">¿Cómo vas a pagar?</p>
                <div className="grid grid-cols-2 gap-2">
                  {METODOS_PAGO.map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMetodoPago(m.value)}
                      className={`rounded-lg border py-1.5 font-body text-xs font-semibold ${
                        metodoPago === m.value
                          ? "border-brand bg-brand text-white"
                          : "border-brand/20 bg-white text-brand"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={solicitarCobro}
                  disabled={enviandoCobro}
                  className="rounded-lg bg-brand py-2 font-body text-xs font-semibold text-white disabled:opacity-60"
                >
                  {enviandoCobro ? "Enviando..." : "Confirmar"}
                </button>
              </div>
            )}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <p className="font-display text-base font-semibold text-brand">Agregar al pedido</p>

          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto o promoción..."
            className="w-full rounded-lg border border-brand/20 bg-white px-3 py-2.5 font-body text-sm text-brand placeholder:text-brand/40 focus:border-brand focus:outline-none"
          />

          {promociones.length > 0 && (
            <div className="flex w-fit gap-1 rounded-lg bg-brand/10 p-1">
              {(["productos", "promociones"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-md px-3 py-1.5 font-body text-xs font-semibold ${
                    tab === t ? "bg-brand text-white" : "text-brand/60"
                  }`}
                >
                  {t === "productos" ? "Productos" : "Promociones"}
                </button>
              ))}
            </div>
          )}

          {(promociones.length === 0 || tab === "productos") ? (
            <>
              {categorias.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {categorias.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategFiltro(cat)}
                      className={`rounded-full px-3 py-1 font-body text-xs font-semibold capitalize ${
                        categFiltro === cat ? "bg-brand text-white" : "bg-brand/10 text-brand"
                      }`}
                    >
                      {cat === "todos" ? "Todos" : cat}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {productosFiltrados.map((p) => (
                  <ItemCatalogo
                    key={p.id}
                    nombre={p.nombre}
                    precio={p.precio}
                    imagen={p.imagen}
                    onAgregar={() => agregarAlCarrito(p, false)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {promocionesFiltradas.map((p) => (
                <ItemCatalogo
                  key={p.id}
                  nombre={p.nombre}
                  precio={p.precio}
                  imagen={p.imagen}
                  esPromo
                  onAgregar={() => agregarAlCarrito(p, true)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Carrito — barra fija abajo, patrón de apps de delivery */}
      {carrito.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-brand/10 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
          {carritoAbierto && (
            <div className="mb-3 flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
              {carrito.map((i) => (
                <div key={i.key} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate font-body text-sm text-brand">{i.nombre}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => cambiarCantidad(i.key, -1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-brand">
                      <Minus size={13} />
                    </button>
                    <span className="w-4 text-center font-body text-sm font-semibold text-brand">{i.cantidad}</span>
                    <button onClick={() => cambiarCantidad(i.key, 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-brand/10 text-brand">
                      <Plus size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCarritoAbierto((v) => !v)}
              className="flex items-center gap-1.5 font-body text-sm font-semibold text-brand"
            >
              <ShoppingBag size={18} />
              {cantidadCarrito} · S/ {totalCarrito.toFixed(2)}
            </button>
            <button
              onClick={confirmarPedido}
              disabled={enviando}
              className="flex-1 rounded-lg bg-brand py-3 font-body text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
            >
              {enviando ? "Enviando..." : "Confirmar pedido"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
