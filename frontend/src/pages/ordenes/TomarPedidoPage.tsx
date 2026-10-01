import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Bike, Check, ChevronRight, Minus, Plus, Search, ShoppingBag, Trash2, UtensilsCrossed, X, type LucideIcon,
} from "lucide-react";
import { LoadingSpinner } from "../../components/common";
import mesasService from "../../services/mesasService";
import ordenesService, { type DetalleOrdenPayload } from "../../services/ordenesService";
import productoService from "../../services/productoService";
import { getErrorMessage } from "../../utils/errors";
import { esSoloAlfabetico, esSoloAlfanumerico, esSoloNumerico, MENSAJES } from "../../utils/validators";
import { PLATAFORMA_DELIVERY, TIPO_ORDEN } from "../../utils/constants";
import type { MesaPlano, Orden, Producto, Promocion, TipoOrden } from "../../types";

// Categoría "de sistema" (bolsas y envases): se ofrece aparte, solo para
// llevar y delivery, no en la carta.
const DESCARTABLES = "Descartables";

const TIPOS: { value: TipoOrden; label: string; Icono: LucideIcon }[] = [
  { value: TIPO_ORDEN.MESA, label: "Mesa", Icono: UtensilsCrossed },
  { value: TIPO_ORDEN.LLEVAR, label: "Para llevar", Icono: ShoppingBag },
  { value: TIPO_ORDEN.DELIVERY, label: "Delivery", Icono: Bike },
];

const PLATAFORMAS = [
  { value: PLATAFORMA_DELIVERY.RAPPI, label: "Rappi" },
  { value: PLATAFORMA_DELIVERY.PEDIDOS_YA, label: "PedidosYa" },
  { value: PLATAFORMA_DELIVERY.DIDI, label: "DiDi Food" },
  { value: PLATAFORMA_DELIVERY.OTRO, label: "Otra" },
];

interface Item {
  key: string;
  tipo: "producto" | "promocion";
  id: number;
  nombre: string;
  precio: number;
  cantidad: number;
  nota: string;
}

interface Cliente {
  nombre: string;
  telefono: string;
  direccion: string;
  plataforma: string;
  plataformaOtra: string;
}

const soles = (n: number | string) => `S/ ${Number(n).toFixed(2)}`;
const PASOS = ["Para quién", "Productos", "Revisar"];

/**
 * Tomar pedido en 3 pasos: para quién (mesa, para llevar o delivery), qué
 * (la carta) y revisar. Desde el salón llega con ?mesa=<id> y arranca en
 * el paso 2. Si la mesa ya tiene pedido, lo nuevo va como otra ronda.
 */
export default function TomarPedidoPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const mesaParam = Number(params.get("mesa")) || null;
  // Desde Pedidos, "Agregar" a una orden para llevar o delivery ya abierta.
  const ordenParam = Number(params.get("orden")) || null;

  const [mesas, setMesas] = useState<MesaPlano[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [promociones, setPromociones] = useState<Promocion[]>([]);
  const [cargando, setCargando] = useState(true);

  const [paso, setPaso] = useState(mesaParam || ordenParam ? 2 : 1);
  const [tipo, setTipo] = useState<TipoOrden>(params.get("tipo") === TIPO_ORDEN.LLEVAR ? TIPO_ORDEN.LLEVAR : TIPO_ORDEN.MESA);
  const [ordenExistente, setOrdenExistente] = useState<Orden | null>(null);
  const [mesaId, setMesaId] = useState<number | null>(mesaParam);
  const [cliente, setCliente] = useState<Cliente>({ nombre: "", telefono: "", direccion: "", plataforma: "", plataformaOtra: "" });
  const [items, setItems] = useState<Item[]>([]);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      mesasService.plano(),
      productoService.listar(),
      productoService.listarPromociones(),
      ordenParam ? ordenesService.obtener(ordenParam).then((r) => r.data) : Promise.resolve(null),
    ])
      .then(([{ data: plano }, prods, promos, orden]) => {
        setMesas(plano.mesas);
        if (orden) {
          setOrdenExistente(orden);
          setTipo(orden.tipo_orden);
          if (orden.mesa) setMesaId(orden.mesa);
        }
        setProductos(prods.filter((p) => p.disponible));
        setPromociones(promos.filter((p) => p.vigente !== false && p.activo));
      })
      .catch((err) => setErrorEnvio(getErrorMessage(err, "No se pudo cargar la carta")))
      .finally(() => setCargando(false));
  }, [ordenParam]);

  const mesa = mesas.find((m) => m.id === mesaId) ?? null;
  const ordenAbierta = ordenExistente?.estado === "abierta"
    ? ordenExistente.id
    : tipo === TIPO_ORDEN.MESA ? mesa?.sala?.orden_id ?? null : null;
  const descartables = productos.filter((p) => p.categoria_nombre === DESCARTABLES);
  const esDescartable = (i: Item) => i.tipo === "producto" && descartables.some((d) => d.id === i.id);
  const carta = productos.filter((p) => p.categoria_nombre !== DESCARTABLES);
  const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const cantidad = items.reduce((s, i) => s + i.cantidad, 0);

  const sumar = (tipoItem: Item["tipo"], p: Producto | Promocion, delta = 1) => {
    const key = `${tipoItem}-${p.id}`;
    setItems((prev) => {
      const existe = prev.find((i) => i.key === key);
      if (existe) {
        return prev.map((i) => (i.key === key ? { ...i, cantidad: Math.max(0, i.cantidad + delta) } : i)).filter((i) => i.cantidad > 0);
      }
      if (delta < 0) return prev;
      return [...prev, { key, tipo: tipoItem, id: p.id, nombre: p.nombre, precio: Number(p.precio), cantidad: delta, nota: "" }];
    });
  };
  const cambiar = (key: string, cambio: Partial<Item>) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...cambio } : i)).filter((i) => i.cantidad > 0));
  const cantidadDe = (key: string) => items.find((i) => i.key === key)?.cantidad ?? 0;

  // ── Paso 1: validar destino ────────────────────────────────────────────
  const validarDestino = (): boolean => {
    const e: Record<string, string> = {};
    if (tipo === TIPO_ORDEN.MESA && !mesaId) e.mesa = "Elige una mesa";
    if (tipo !== TIPO_ORDEN.MESA && cliente.nombre && !esSoloAlfabetico(cliente.nombre)) e.nombre = MENSAJES.SOLO_ALFABETICO;
    if (tipo === TIPO_ORDEN.DELIVERY) {
      if (!cliente.plataforma) e.plataforma = "Elige la plataforma";
      if (cliente.plataforma === PLATAFORMA_DELIVERY.OTRO && !cliente.plataformaOtra.trim()) e.plataformaOtra = "Escribe cuál";
      else if (cliente.plataformaOtra && !esSoloAlfanumerico(cliente.plataformaOtra)) e.plataformaOtra = MENSAJES.SOLO_ALFANUMERICO;
      if (cliente.telefono && !esSoloNumerico(cliente.telefono)) e.telefono = MENSAJES.SOLO_NUMERICO;
      if (cliente.direccion && !esSoloAlfanumerico(cliente.direccion)) e.direccion = MENSAJES.SOLO_ALFANUMERICO;
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  };

  const irA = (n: number) => {
    if (n >= 2 && !validarDestino()) return setPaso(1);
    setPaso(n);
    window.scrollTo({ top: 0 });
  };

  // ── Enviar ─────────────────────────────────────────────────────────────
  const enviar = async () => {
    if (!items.length) return;
    setEnviando(true);
    setErrorEnvio(null);
    const detalles: DetalleOrdenPayload[] = items.map((i) => ({
      producto: i.tipo === "producto" ? i.id : null,
      promocion: i.tipo === "promocion" ? i.id : null,
      cantidad: i.cantidad,
      nota: i.nota.trim(),
    }));
    try {
      if (ordenAbierta) {
        await ordenesService.ronda(ordenAbierta, detalles);
      } else {
        await ordenesService.crear({
          tipo_orden: tipo,
          mesa: tipo === TIPO_ORDEN.MESA ? mesaId : null,
          detalles,
          ...(tipo !== TIPO_ORDEN.MESA ? { cliente_nombre: cliente.nombre.trim() } : {}),
          ...(tipo === TIPO_ORDEN.DELIVERY
            ? {
                cliente_telefono: cliente.telefono.trim(),
                direccion_entrega: cliente.direccion.trim(),
                plataforma_delivery: cliente.plataforma,
                ...(cliente.plataforma === PLATAFORMA_DELIVERY.OTRO ? { plataforma_otra: cliente.plataformaOtra.trim() } : {}),
              }
            : {}),
        });
      }
      const aviso = ordenAbierta && tipo !== TIPO_ORDEN.MESA
        ? `Se agregó al pedido #${ordenAbierta}`
        : tipo === TIPO_ORDEN.MESA ? `Pedido de la mesa ${mesa?.numero} enviado a cocina` : "Pedido enviado a cocina";
      navigate(tipo === TIPO_ORDEN.MESA ? "/mesas" : "/ordenes", { state: { aviso } });
    } catch (err) {
      setErrorEnvio(getErrorMessage(err, "No se pudo enviar el pedido"));
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) return <LoadingSpinner texto="Cargando la carta…" />;

  const destino = ordenExistente && tipo !== TIPO_ORDEN.MESA
    ? `${ordenExistente.tipo_orden_display ?? "Pedido"} #${ordenExistente.id}${ordenExistente.cliente_nombre ? ` · ${ordenExistente.cliente_nombre}` : ""} · se suma a su pedido`
    : tipo === TIPO_ORDEN.MESA
      ? mesa ? `Mesa ${mesa.numero}${ordenAbierta ? " · se suma a su pedido" : ""}` : "Sin mesa"
      : tipo === TIPO_ORDEN.LLEVAR
        ? `Para llevar${cliente.nombre ? ` · ${cliente.nombre}` : ""}`
        : `Delivery · ${PLATAFORMAS.find((p) => p.value === cliente.plataforma)?.label ?? ""}${cliente.nombre ? ` · ${cliente.nombre}` : ""}`;

  return (
    <div className="flex flex-col gap-5 pb-28 md:pb-0">
      {/* Encabezado y pasos */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} aria-label="Volver" className="grid size-10 shrink-0 place-items-center rounded-xl border border-linea bg-marfil text-espresso">
          <ArrowLeft className="size-4.5" />
        </button>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-semibold text-espresso">{ordenAbierta ? "Agregar al pedido" : "Tomar pedido"}</h2>
          {paso > 1 && <p className="truncate text-sm text-suave">{destino}</p>}
        </div>
      </div>

      <ol className="grid grid-cols-3 gap-2" aria-label="Pasos">
        {PASOS.map((p, n) => {
          const num = n + 1;
          const hecho = num < paso;
          const actual = num === paso;
          return (
            <li key={p}>
              <button
                type="button"
                onClick={() => num < paso && irA(num)}
                disabled={num > paso}
                aria-current={actual ? "step" : undefined}
                className="flex w-full flex-col gap-1.5 text-left"
              >
                <span className={`h-1.5 rounded-full ${hecho || actual ? "bg-salvia" : "bg-linea"}`} />
                <span className={`flex items-center gap-1.5 text-sm ${actual ? "font-semibold text-espresso" : hecho ? "text-salvia-osc" : "text-tenue"}`}>
                  {hecho ? <Check className="size-3.5" /> : <span className="tabular-nums">{num}.</span>} {p}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {errorEnvio && <p role="alert" className="rounded-xl bg-peligro-fondo px-4 py-3 text-sm text-peligro">{errorEnvio}</p>}

      {paso === 1 && (
        <PasoDestino
          tipo={tipo} setTipo={(t) => { setTipo(t); setErrores({}); }}
          mesas={mesas} mesaId={mesaId} setMesaId={setMesaId}
          cliente={cliente} setCliente={setCliente} errores={errores}
          onSiguiente={() => irA(2)}
        />
      )}

      {paso === 2 && (
        <PasoProductos
          carta={carta} promociones={promociones} items={items} cantidadDe={cantidadDe} sumar={sumar}
          total={total} cantidad={cantidad} onSiguiente={() => irA(3)}
        />
      )}

      {paso === 3 && (
        <section className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
          <div className="flex flex-col gap-3">
            {items.filter((i) => !esDescartable(i)).length === 0 ? (
              <p className="rounded-2xl border border-dashed border-linea-fuerte px-4 py-10 text-center text-sm text-tenue">
                No elegiste productos. <button type="button" className="font-semibold text-salvia-osc underline" onClick={() => irA(2)}>Volver a la carta</button>
              </p>
            ) : (
              <ul className="divide-y divide-linea rounded-2xl border border-linea bg-marfil">
                {items.filter((i) => !esDescartable(i)).map((i) => (
                  <li key={i.key} className="flex flex-col gap-2 p-4">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-espresso">{i.nombre}</p>
                        <p className="text-sm text-suave tabular-nums">{soles(i.precio)} c/u · {soles(i.precio * i.cantidad)}</p>
                      </div>
                      <Stepper valor={i.cantidad} onMenos={() => cambiar(i.key, { cantidad: i.cantidad - 1 })} onMas={() => cambiar(i.key, { cantidad: i.cantidad + 1 })} />
                      <button type="button" aria-label={`Quitar ${i.nombre}`} onClick={() => cambiar(i.key, { cantidad: 0 })} className="grid size-9 place-items-center rounded-full text-tenue hover:bg-arena hover:text-peligro">
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <input
                      value={i.nota}
                      onChange={(e) => cambiar(i.key, { nota: e.target.value })}
                      maxLength={150}
                      placeholder="Nota para cocina (opcional): sin azúcar, bien caliente…"
                      aria-label={`Nota para ${i.nombre}`}
                      className="h-10 rounded-xl border border-linea bg-beige px-3 text-base text-espresso placeholder:text-tenue outline-none focus:border-salvia sm:text-sm"
                    />
                  </li>
                ))}
              </ul>
            )}

            {tipo !== TIPO_ORDEN.MESA && descartables.length > 0 && (
              <div className="rounded-2xl border border-linea bg-marfil p-4">
                <p className="mb-2 text-sm font-semibold text-espresso">Bolsas y envases</p>
                <ul className="flex flex-col gap-2">
                  {descartables.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-espresso">{d.nombre}</span>
                      <Stepper valor={cantidadDe(`producto-${d.id}`)} onMenos={() => sumar("producto", d, -1)} onMas={() => sumar("producto", d, 1)} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-3 rounded-2xl border border-linea bg-marfil p-4 lg:sticky lg:top-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-tenue">Para</p>
              <p className="font-semibold text-espresso">{destino}</p>
              {tipo === TIPO_ORDEN.DELIVERY && cliente.direccion && <p className="text-sm text-suave">{cliente.direccion}</p>}
              {!ordenExistente && (
                <button type="button" onClick={() => irA(1)} className="mt-1 text-sm font-medium text-salvia-osc underline">Cambiar</button>
              )}
            </div>
            <div className="flex items-baseline justify-between border-t border-linea pt-3">
              <span className="text-sm text-suave">{cantidad} {cantidad === 1 ? "producto" : "productos"}</span>
              <span className="font-display text-2xl font-semibold text-espresso tabular-nums">{soles(total)}</span>
            </div>
            <button
              type="button"
              onClick={enviar}
              disabled={enviando || items.length === 0}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-salvia text-[15px] font-semibold text-marfil hover:bg-salvia-osc disabled:opacity-50"
            >
              {enviando ? "Enviando…" : ordenAbierta ? "Agregar y enviar a cocina" : "Enviar a cocina"}
            </button>
          </aside>
        </section>
      )}
    </div>
  );
}

function PasoDestino({
  tipo, setTipo, mesas, mesaId, setMesaId, cliente, setCliente, errores, onSiguiente,
}: {
  tipo: TipoOrden;
  setTipo: (t: TipoOrden) => void;
  mesas: MesaPlano[];
  mesaId: number | null;
  setMesaId: (id: number) => void;
  cliente: Cliente;
  setCliente: (c: Cliente) => void;
  errores: Record<string, string>;
  onSiguiente: () => void;
}) {
  const campo = (k: keyof Cliente, label: string, extra: { placeholder?: string; inputMode?: "tel" | "text" } = {}) => (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-espresso">
      {label}
      <input
        value={cliente[k]}
        onChange={(e) => setCliente({ ...cliente, [k]: e.target.value })}
        placeholder={extra.placeholder}
        inputMode={extra.inputMode}
        aria-invalid={!!errores[k] || undefined}
        className={`h-11 rounded-xl border bg-marfil px-3.5 text-base font-normal outline-none focus:border-salvia sm:text-sm ${errores[k] ? "border-peligro" : "border-linea-fuerte"}`}
      />
      {errores[k] && <span className="text-xs font-normal text-peligro">{errores[k]}</span>}
    </label>
  );

  return (
    <section className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de pedido">
        {TIPOS.map(({ value, label, Icono }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={tipo === value}
            onClick={() => setTipo(value)}
            className={`flex flex-col items-center gap-2 rounded-2xl border px-2 py-4 text-sm font-semibold transition-colors ${
              tipo === value ? "border-salvia bg-salvia-clara text-salvia-osc" : "border-linea bg-marfil text-espresso hover:bg-arena"
            }`}
          >
            <Icono className="size-6" strokeWidth={1.7} /> {label}
          </button>
        ))}
      </div>

      {tipo === TIPO_ORDEN.MESA && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-espresso">¿Qué mesa?</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {[...mesas].sort((a, b) => a.numero - b.numero).map((m) => {
              const conPedido = !!m.sala?.orden_id;
              const elegida = mesaId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMesaId(m.id)}
                  aria-pressed={elegida}
                  className={`flex aspect-square flex-col items-center justify-center rounded-2xl border-2 transition-colors ${
                    elegida ? "border-salvia bg-salvia text-marfil" : conPedido ? "border-transparent bg-salvia-clara text-salvia-osc" : m.estado === "reservada" ? "border-dashed border-aviso/60 bg-aviso-fondo text-aviso" : "border-linea bg-marfil text-espresso"
                  }`}
                >
                  <span className="font-display text-2xl font-semibold leading-none">{m.numero}</span>
                  <span className="mt-1 text-[11px]">{conPedido ? "con pedido" : m.estado === "reservada" ? "reservada" : "libre"}</span>
                </button>
              );
            })}
          </div>
          {errores.mesa && <p className="text-sm text-peligro">{errores.mesa}</p>}
        </div>
      )}

      {tipo === TIPO_ORDEN.LLEVAR && (
        <div className="grid gap-4 sm:max-w-md">{campo("nombre", "Nombre del cliente (opcional)", { placeholder: "Para llamarlo cuando esté listo" })}</div>
      )}

      {tipo === TIPO_ORDEN.DELIVERY && (
        <div className="grid gap-4 sm:max-w-xl sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-espresso">Plataforma</span>
            <div className="flex flex-wrap gap-2">
              {PLATAFORMAS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setCliente({ ...cliente, plataforma: p.value })}
                  aria-pressed={cliente.plataforma === p.value}
                  className={`h-10 rounded-full border px-4 text-sm font-medium ${cliente.plataforma === p.value ? "border-salvia bg-salvia-clara text-salvia-osc" : "border-linea bg-marfil text-espresso"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {errores.plataforma && <span className="text-xs text-peligro">{errores.plataforma}</span>}
          </div>
          {cliente.plataforma === PLATAFORMA_DELIVERY.OTRO && campo("plataformaOtra", "¿Cuál?")}
          {campo("nombre", "Nombre del cliente")}
          {campo("telefono", "Teléfono", { inputMode: "tel" })}
          <div className="sm:col-span-2">{campo("direccion", "Dirección de entrega")}</div>
        </div>
      )}

      <button type="button" onClick={onSiguiente} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-salvia px-6 text-[15px] font-semibold text-marfil hover:bg-salvia-osc sm:w-fit">
        Elegir productos <ChevronRight className="size-4.5" />
      </button>
    </section>
  );
}

function PasoProductos({
  carta, promociones, items, cantidadDe, sumar, total, cantidad, onSiguiente,
}: {
  carta: Producto[];
  promociones: Promocion[];
  items: Item[];
  cantidadDe: (key: string) => number;
  sumar: (tipo: Item["tipo"], p: Producto | Promocion, delta?: number) => void;
  total: number;
  cantidad: number;
  onSiguiente: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const categorias = useMemo(
    () => [...new Set(carta.map((p) => p.categoria_nombre || "Otros"))].sort(),
    [carta]
  );
  const t = busqueda.trim().toLowerCase();
  const verPromos = promociones.length > 0 && (categoria === "todas" || categoria === "promos");
  const productosVisibles = carta.filter(
    (p) => (categoria === "todas" || (p.categoria_nombre || "Otros") === categoria) && (!t || p.nombre.toLowerCase().includes(t))
  );
  const promosVisibles = verPromos ? promociones.filter((p) => !t || p.nombre.toLowerCase().includes(t)) : [];

  const tarjeta = (tipo: Item["tipo"], p: Producto | Promocion) => {
    const n = cantidadDe(`${tipo}-${p.id}`);
    return (
      <div key={`${tipo}-${p.id}`} className={`relative flex min-h-24 flex-col justify-between rounded-2xl border p-3 transition-colors ${n ? "border-salvia bg-salvia-clara/50" : "border-linea bg-marfil"}`}>
        <button type="button" onClick={() => sumar(tipo, p)} className="absolute inset-0 rounded-2xl" aria-label={`Agregar ${p.nombre}`} />
        <span className="pointer-events-none pr-6 text-sm font-medium leading-snug text-espresso">
          {tipo === "promocion" && <span className="mr-1 rounded bg-champan-claro px-1 text-[10px] font-bold uppercase text-champan">Promo</span>}
          {p.nombre}
        </span>
        <span className="pointer-events-none mt-2 text-sm text-suave tabular-nums">{soles(p.precio)}</span>
        {n > 0 && (
          <div className="relative mt-2 flex items-center justify-between">
            <button type="button" onClick={() => sumar(tipo, p, -1)} aria-label={`Quitar un ${p.nombre}`} className="grid size-8 place-items-center rounded-full bg-marfil text-espresso shadow-suave">
              <Minus className="size-4" />
            </button>
            <span className="font-semibold text-salvia-osc tabular-nums">{n}</span>
            <button type="button" onClick={() => sumar(tipo, p)} aria-label={`Agregar otro ${p.nombre}`} className="grid size-8 place-items-center rounded-full bg-salvia text-marfil">
              <Plus className="size-4" />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="grid gap-5 lg:grid-cols-[1fr_300px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-3">
        <label className="flex h-11 items-center gap-2.5 rounded-xl border border-linea-fuerte bg-marfil px-3.5 focus-within:border-salvia">
          <Search className="size-4 text-tenue" aria-hidden />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto"
            aria-label="Buscar producto"
            className="min-w-0 flex-1 bg-transparent text-base text-espresso outline-none placeholder:text-tenue sm:text-sm"
          />
          {busqueda && <button type="button" onClick={() => setBusqueda("")} aria-label="Borrar"><X className="size-4 text-tenue" /></button>}
        </label>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0 [scrollbar-width:none]">
          {["todas", ...(promociones.length ? ["promos"] : []), ...categorias].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoria(c)}
              className={`h-9 shrink-0 rounded-full px-4 text-sm font-medium ${categoria === c ? "bg-espresso text-marfil" : "border border-linea bg-marfil text-espresso"}`}
            >
              {c === "todas" ? "Todo" : c === "promos" ? "Promociones" : c}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
          {promosVisibles.map((p) => tarjeta("promocion", p))}
          {categoria !== "promos" && productosVisibles.map((p) => tarjeta("producto", p))}
        </div>
        {!promosVisibles.length && (categoria === "promos" || !productosVisibles.length) && (
          <p className="py-8 text-center text-sm text-tenue">No hay productos que coincidan.</p>
        )}
      </div>

      {/* Resumen: columna en pantallas grandes, barra abajo en el celular */}
      <aside className="hidden flex-col gap-3 rounded-2xl border border-linea bg-marfil p-4 lg:sticky lg:top-4 lg:flex">
        <p className="text-sm font-semibold text-espresso">Pedido</p>
        {items.length === 0 ? (
          <p className="text-sm text-tenue">Toca un producto para agregarlo.</p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto text-sm">
            {items.map((i) => (
              <li key={i.key} className="flex justify-between gap-2">
                <span className="text-espresso">{i.cantidad} × {i.nombre}</span>
                <span className="shrink-0 text-suave tabular-nums">{soles(i.precio * i.cantidad)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-baseline justify-between border-t border-linea pt-3">
          <span className="text-sm text-suave">Total</span>
          <span className="font-display text-xl font-semibold text-espresso tabular-nums">{soles(total)}</span>
        </div>
        <button type="button" onClick={onSiguiente} disabled={!items.length} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-salvia font-semibold text-marfil disabled:opacity-50">
          Revisar <ChevronRight className="size-4" />
        </button>
      </aside>

      {items.length > 0 && (
        <div className="fixed inset-x-0 z-30 px-4 lg:hidden" style={{ bottom: "calc(var(--barra-inferior) + 12px)" }}>
          <button type="button" onClick={onSiguiente} className="mx-auto flex h-14 w-full max-w-lg items-center gap-3 rounded-2xl bg-salvia pl-3 pr-5 text-marfil shadow-alta">
            <span className="grid size-9 place-items-center rounded-xl bg-marfil/15 text-sm font-bold tabular-nums">{cantidad}</span>
            <span className="flex-1 text-left font-semibold">Revisar pedido</span>
            <span className="font-semibold tabular-nums">{soles(total)}</span>
          </button>
        </div>
      )}
    </section>
  );
}

function Stepper({ valor, onMenos, onMas }: { valor: number; onMenos: () => void; onMas: () => void }) {
  return (
    <div className="flex items-center rounded-full border border-linea-fuerte bg-beige p-0.5">
      <button type="button" onClick={onMenos} disabled={valor === 0} aria-label="Uno menos" className="grid size-8 place-items-center rounded-full text-espresso disabled:opacity-30">
        <Minus className="size-4" />
      </button>
      <span className="w-7 text-center text-sm font-semibold tabular-nums">{valor}</span>
      <button type="button" onClick={onMas} aria-label="Uno más" className="grid size-8 place-items-center rounded-full text-espresso">
        <Plus className="size-4" />
      </button>
    </div>
  );
}
