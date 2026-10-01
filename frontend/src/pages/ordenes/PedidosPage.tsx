import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bike, CheckCircle2, ChevronRight, Plus, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { DataTable, EmptyState, LoadingSpinner, PageHeader, StatusBadge } from "../../components/common";
import ordenesService from "../../services/ordenesService";
import authService from "../../services/authService";
import { getErrorMessage } from "../../utils/errors";
import { useReloj } from "../../hooks/useReloj";
import DetallePedido from "./DetallePedido";
import { paraQuien } from "./pedidos";
import type { Columna, Orden } from "../../types";

const POLL_MS = 10000;
const soles = (n: number | string) => `S/ ${Number(n).toFixed(2)}`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-PE", { hour: "numeric", minute: "2-digit" });
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/**
 * Pedidos: lo que está en curso (sobre todo para llevar y delivery; las
 * mesas se atienden desde el salón) y el historial del día.
 */
export default function PedidosPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [vista, setVista] = useState<"curso" | "historial">("curso");
  const [aviso, setAviso] = useState<string | null>((location.state as { aviso?: string } | null)?.aviso ?? null);
  const [abierto, setAbierto] = useState<Orden | null>(null);

  useEffect(() => {
    if (!aviso) return;
    navigate(location.pathname, { replace: true, state: null });
    const t = setTimeout(() => setAviso(null), 4000);
    return () => clearTimeout(t);
  }, [aviso, navigate, location.pathname]);

  return (
    <>
      <PageHeader
        titulo="Pedidos"
        descripcion="Para llevar, delivery y el historial del día"
        accion={
          authService.hasRole("admin") || authService.hasRole("mesero") ? (
            <Link to="/ordenes/nuevo?tipo=llevar" className="flex h-11 items-center justify-center gap-2 rounded-xl bg-salvia px-4 text-sm font-semibold text-marfil hover:bg-salvia-osc">
              <Plus className="size-4" /> Nuevo pedido
            </Link>
          ) : undefined
        }
      />

      {aviso && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-xl bg-exito-fondo px-4 py-3 text-sm font-medium text-exito">
          <CheckCircle2 className="size-4" /> {aviso}
        </p>
      )}

      <div className="mb-4 inline-flex rounded-xl bg-arena p-1" role="tablist">
        {([["curso", "En curso"], ["historial", "Historial"]] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vista === v}
            onClick={() => setVista(v)}
            className={`h-9 rounded-lg px-4 text-sm font-medium ${vista === v ? "bg-marfil text-espresso shadow-suave" : "text-suave"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {vista === "curso" ? <EnCurso onAbrir={setAbierto} /> : <Historial onAbrir={setAbierto} />}

      {abierto && <DetallePedido orden={abierto} onCerrar={() => setAbierto(null)} onCambio={() => undefined} />}
    </>
  );
}

function EnCurso({ onAbrir }: { onAbrir: (o: Orden) => void }) {
  const ahora = useReloj().getTime();
  const [ordenes, setOrdenes] = useState<Orden[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    ordenesService
      .listarAbiertas()
      .then((lista) => { setOrdenes(lista); setError(null); })
      .catch((err) => setError(getErrorMessage(err, "No se pudieron cargar los pedidos")));
  }, []);

  useEffect(() => {
    cargar();
    const iv = setInterval(() => document.visibilityState === "visible" && cargar(), POLL_MS);
    return () => clearInterval(iv);
  }, [cargar]);

  if (error) return <p className="rounded-xl bg-peligro-fondo px-4 py-3 text-sm text-peligro">{error}</p>;
  if (!ordenes) return <LoadingSpinner texto="Cargando pedidos…" />;

  const deMesa = ordenes.filter((o) => o.tipo_orden === "mesa").sort((a, b) => (a.mesa_numero ?? 0) - (b.mesa_numero ?? 0));
  const otros = ordenes.filter((o) => o.tipo_orden !== "mesa").sort((a, b) => a.fecha_creacion.localeCompare(b.fecha_creacion));
  const minutos = (iso: string) => Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60000));

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h3 className="mb-2 text-sm font-semibold text-suave">Para llevar y delivery</h3>
        {otros.length === 0 ? (
          <EmptyState titulo="No hay pedidos para llevar ni delivery" subtitulo='Usa "Nuevo pedido" para tomar uno.' icono={<ShoppingBag strokeWidth={1.6} />} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {otros.map((o) => {
              const listos = o.detalles.filter((d) => d.estado_preparacion === "listo").length;
              const enCocina = o.detalles.filter((d) => d.estado_preparacion === "pendiente" || d.estado_preparacion === "en_preparacion").length;
              const Icono = o.tipo_orden === "delivery" ? Bike : ShoppingBag;
              return (
                <li key={o.id}>
                  <button type="button" onClick={() => onAbrir(o)} className="flex w-full flex-col gap-3 rounded-2xl border border-linea bg-marfil p-4 text-left shadow-suave hover:border-linea-fuerte">
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-arena text-espresso"><Icono className="size-5" strokeWidth={1.7} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-espresso">{paraQuien(o)}</p>
                        <p className="text-sm text-suave">#{o.id} · {hora(o.fecha_creacion)} · hace {minutos(o.fecha_creacion)} min</p>
                      </div>
                      <span className="font-semibold text-espresso tabular-nums">{soles(o.total)}</span>
                    </div>
                    <p className="line-clamp-2 text-sm text-espresso">
                      {o.detalles.map((d) => `${d.cantidad} ${d.producto?.nombre ?? d.promocion?.nombre ?? ""}`).join(", ")}
                    </p>
                    <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${enCocina ? "bg-info-fondo text-info" : listos ? "bg-exito-fondo text-exito" : "bg-arena text-suave"}`}>
                      {enCocina ? "En cocina" : listos ? "Listo para entregar" : "Entregado · por cobrar"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-suave">Mesas con pedido</h3>
        {deMesa.length === 0 ? (
          <p className="text-sm text-tenue">Ninguna mesa tiene pedido abierto.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {deMesa.map((o) => (
              <button key={o.id} type="button" onClick={() => onAbrir(o)} className="flex h-10 items-center gap-2 rounded-full border border-linea bg-marfil px-3.5 text-sm hover:bg-arena">
                <UtensilsCrossed className="size-3.5 text-suave" />
                <span className="font-semibold text-espresso">Mesa {o.mesa_numero}</span>
                <span className="text-suave tabular-nums">{soles(o.total)}</span>
                {o.cuenta_pedida && <span className="rounded-full bg-champan px-2 py-0.5 text-[10px] font-bold text-marfil">POR COBRAR</span>}
              </button>
            ))}
            <Link to="/mesas" className="flex h-10 items-center gap-1 px-2 text-sm font-medium text-salvia-osc">
              Ver el salón <ChevronRight className="size-4" />
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function Historial({ onAbrir }: { onAbrir: (o: Orden) => void }) {
  const esAdmin = authService.hasRole("admin");
  const [fecha, setFecha] = useState(hoyISO);
  const [tipo, setTipo] = useState<"todos" | "mesa" | "llevar" | "delivery">("todos");
  const [ordenes, setOrdenes] = useState<Orden[] | null>(null);
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    let vivo = true;
    ordenesService
      .listarDelDia(esAdmin && fecha !== hoyISO() ? fecha : undefined)
      .then((lista) => vivo && setOrdenes(lista.filter((o) => o.estado !== "abierta")))
      .catch(() => vivo && setOrdenes([]));
    return () => { vivo = false; };
  }, [fecha, esAdmin]);

  const filtradas = (ordenes ?? []).filter((o) => tipo === "todos" || o.tipo_orden === tipo).sort((a, b) => b.fecha_creacion.localeCompare(a.fecha_creacion));
  const cobrado = filtradas.filter((o) => o.estado === "cerrada").reduce((s, o) => s + Number(o.total), 0);
  const POR_PAGINA = 15;

  const columnas: Columna<Orden>[] = [
    { label: "Pedido", render: (o) => <button type="button" onClick={() => onAbrir(o)} className="font-semibold text-espresso hover:underline">{paraQuien(o)}</button> },
    { label: "Hora", render: (o) => `${hora(o.fecha_creacion)}${o.fecha_cierre ? ` – ${hora(o.fecha_cierre)}` : ""}` },
    { label: "Atendió", render: (o) => o.usuario_nombre ?? "—" },
    { label: "Estado", render: (o) => <StatusBadge estado={o.estado} size="sm" /> },
    { label: "Total", render: (o) => <span className="tabular-nums">{soles(o.total)}</span> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {esAdmin && (
          <label className="flex flex-col gap-1 text-sm font-medium text-espresso">
            Día
            <input type="date" value={fecha} max={hoyISO()} onChange={(e) => { setFecha(e.target.value || hoyISO()); setPagina(1); setOrdenes(null); }} className="h-10 rounded-xl border border-linea-fuerte bg-marfil px-3 text-sm" />
          </label>
        )}
        <div className="flex flex-wrap gap-1.5">
          {(["todos", "mesa", "llevar", "delivery"] as const).map((t) => (
            <button key={t} type="button" onClick={() => { setTipo(t); setPagina(1); }} className={`h-10 rounded-full px-4 text-sm font-medium ${tipo === t ? "bg-espresso text-marfil" : "border border-linea bg-marfil text-espresso"}`}>
              {{ todos: "Todos", mesa: "Mesas", llevar: "Para llevar", delivery: "Delivery" }[t]}
            </button>
          ))}
        </div>
        <p className="ml-auto text-sm text-suave">
          {filtradas.length} pedidos · cobrado <b className="text-espresso tabular-nums">{soles(cobrado)}</b>
        </p>
      </div>
      <DataTable
        columnas={columnas}
        datos={filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)}
        total={filtradas.length}
        pagina={pagina}
        porPagina={POR_PAGINA}
        onPagina={setPagina}
        cargando={ordenes === null}
        textoVacio="No hay pedidos cerrados en este día"
      />
    </div>
  );
}
