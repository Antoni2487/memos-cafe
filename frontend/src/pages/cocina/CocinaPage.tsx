import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Check, ChefHat, Maximize2, Minimize2, Package, Volume2 } from "lucide-react";
import { useCocina, type ComandaTablero } from "../../hooks/useCocina";
import { useReloj } from "../../hooks/useReloj";
import { LoadingSpinner } from "../../components/common";
import { habilitarSonido, sonidoHabilitado } from "../../utils/sonido";
import type { EstadoComanda } from "../../types";

// Umbrales acordados: a los 10 min la comanda se pone ámbar, a los 20 roja.
const MIN_AMBAR = 10;
const MIN_ROJO = 20;

type Columna = "pendiente" | "en_preparacion" | "lista";

const COLUMNAS: { estado: Columna; titulo: string; vacio: string }[] = [
  { estado: "pendiente", titulo: "Nuevas", vacio: "Sin comandas nuevas" },
  { estado: "en_preparacion", titulo: "Preparando", vacio: "Nada en preparación" },
  { estado: "lista", titulo: "Listas", vacio: "Nada esperando al mesero" },
];

const CONEXION = {
  conectado: { clase: "bg-exito", label: "En vivo" },
  conectando: { clase: "bg-aviso", label: "Conectando…" },
  reconectando: { clase: "bg-peligro", label: "Reconectando…" },
} as const;

function reloj(ms: number): string {
  const seg = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Tablero de Cocina (KDS) pensado para tablet y celular: una tarjeta por
 * comanda, con su cronómetro. En pantalla ancha, tres columnas (Nuevas,
 * Preparando, Listas); en el celular, pestañas.
 */
export default function CocinaPage() {
  const cocina = useCocina();
  const ahora = useReloj().getTime();
  const [pestana, setPestana] = useState<Columna>("pendiente");
  const [sonidoOk, setSonidoOk] = useState(sonidoHabilitado);
  const pantallaCompleta = usePantallaCompleta();
  useMantenerPantallaEncendida();

  const porEstado = (e: EstadoComanda) => cocina.comandas.filter((c) => c.estado === e);
  const conexion = CONEXION[cocina.status];

  const activarSonido = async () => {
    const ok = await habilitarSonido();
    setSonidoOk(ok);
    if (ok && !cocina.sonido) cocina.setSonido(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="hidden md:block font-display text-[26px] font-semibold text-espresso">Cocina</h2>
          <span className="flex items-center gap-2 rounded-full border border-linea bg-marfil px-3 py-1.5 text-sm text-espresso" role="status">
            <span className={`size-2 rounded-full ${conexion.clase} ${cocina.status === "conectado" ? "" : "animate-pulse"}`} />
            {conexion.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cocina.setSonido(!cocina.sonido)}
            aria-pressed={cocina.sonido}
            className="flex h-10 items-center gap-2 rounded-xl border border-linea bg-marfil px-3 text-sm font-medium text-espresso"
          >
            {cocina.sonido ? <Bell className="size-4" /> : <BellOff className="size-4 text-tenue" />}
            <span className="hidden sm:inline">{cocina.sonido ? "Sonido activado" : "Sin sonido"}</span>
          </button>
          {pantallaCompleta.disponible && (
            <button
              type="button"
              onClick={pantallaCompleta.alternar}
              aria-label={pantallaCompleta.activa ? "Salir de pantalla completa" : "Pantalla completa"}
              className="grid size-10 place-items-center rounded-xl border border-linea bg-marfil text-espresso"
            >
              {pantallaCompleta.activa ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          )}
        </div>
      </div>

      {cocina.sonido && !sonidoOk && (
        <button
          type="button"
          onClick={activarSonido}
          className="flex items-center gap-3 rounded-2xl border border-aviso/30 bg-aviso-fondo px-4 py-3 text-left text-sm text-aviso"
        >
          <Volume2 className="size-5 shrink-0" />
          <span><b>Toca aquí para activar el sonido.</b> El navegador no deja sonar hasta que alguien toque la pantalla.</span>
        </button>
      )}

      {cocina.error && <p role="alert" className="rounded-xl bg-peligro-fondo px-4 py-2.5 text-sm text-peligro">{cocina.error}</p>}

      {/* Pestañas en pantallas angostas */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-arena p-1 lg:hidden" role="tablist">
        {COLUMNAS.map(({ estado, titulo }) => {
          const n = porEstado(estado).length;
          const activa = pestana === estado;
          return (
            <button
              key={estado}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setPestana(estado)}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors ${
                activa ? "bg-marfil text-espresso shadow-suave" : "text-suave"
              }`}
            >
              {titulo}
              <span className={`grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs tabular-nums ${
                n && estado === "pendiente" ? "bg-peligro text-marfil" : activa ? "bg-salvia-clara text-salvia-osc" : "bg-marfil/70"
              }`}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {cocina.cargando ? (
        <LoadingSpinner texto="Cargando tablero…" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
          {COLUMNAS.map(({ estado, titulo, vacio }) => {
            const lista = porEstado(estado);
            return (
              <section
                key={estado}
                aria-label={titulo}
                className={`${pestana === estado ? "flex" : "hidden"} lg:flex flex-col gap-3 lg:rounded-3xl lg:bg-arena/60 lg:p-3`}
              >
                <h3 className="hidden lg:flex items-center justify-between px-1 text-sm font-semibold text-suave">
                  {titulo}
                  <span className="tabular-nums">{lista.length}</span>
                </h3>
                {lista.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-linea-fuerte px-4 py-10 text-center text-sm text-tenue">
                    <ChefHat className="size-6" strokeWidth={1.5} />
                    {vacio}
                  </div>
                ) : (
                  lista.map((c) => <TarjetaComanda key={c.id} comanda={c} ahora={ahora} cocina={cocina} />)
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** "Tatiana Montenegro" → "Tatiana"; "lucia@memos.pe" → "lucia". */
const nombreDePila = (quien: string) => quien.split("@")[0].trim().split(/\s+/)[0] ?? "";

/** Para quién va la comanda, en lo que el cocinero necesita saber. */
function destino(c: ComandaTablero): string {
  if (c.tipo_orden === "mesa" && c.mesa_numero !== null) return `Mesa ${c.mesa_numero}`;
  if (c.tipo_orden === "delivery") return c.plataforma ? `Delivery · ${c.plataforma}` : "Delivery";
  return "Para llevar";
}

function TarjetaComanda({
  comanda: c,
  ahora,
  cocina,
}: {
  comanda: ComandaTablero;
  ahora: number;
  cocina: ReturnType<typeof useCocina>;
}) {
  const [ocupado, setOcupado] = useState(false);
  const hacer = async (fn: () => Promise<void>) => {
    setOcupado(true);
    await fn();
    setOcupado(false);
  };

  // El color mide la espera del cliente: desde que llegó la comanda hasta
  // que sale de cocina. Ya lista, lo que corre es la espera por el mesero.
  const minutos = (ahora - c.desde.creada) / 60000;
  const tono = c.estado === "lista" ? "listo" : minutos >= MIN_ROJO ? "rojo" : minutos >= MIN_AMBAR ? "ambar" : "normal";
  const franja = { normal: "bg-linea-fuerte", ambar: "bg-aviso", rojo: "bg-peligro", listo: "bg-exito" }[tono];
  const cronometro = {
    normal: "text-espresso",
    ambar: "text-aviso",
    rojo: "text-peligro",
    listo: "text-exito",
  }[tono];

  const empacar = c.tipo_orden !== "mesa";
  const mesero = c.mesero ? nombreDePila(c.mesero) : "";
  const hechos = c.detalles.filter((d) => d.estado_preparacion === "listo" || d.estado_preparacion === "entregado").length;
  const total = c.detalles.length;
  // Los productos se marcan con un toque mientras la comanda está en cocina
  // (marcar uno de una comanda nueva la empieza).
  const tocable = c.estado === "pendiente" || c.estado === "en_preparacion";

  return (
    <article className="overflow-hidden rounded-2xl border border-linea bg-marfil shadow-suave">
      <div className={`h-1.5 ${franja}`} aria-hidden />
      <header className="flex items-start justify-between gap-3 px-4 pt-3">
        <div className="min-w-0">
          <h4 className="font-display text-[26px] font-semibold leading-tight text-balance break-words text-espresso">{destino(c)}</h4>
          {(c.numero > 1 || empacar) && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {c.numero > 1 && (
                <span className="rounded-full bg-champan-claro px-2.5 py-0.5 text-[13px] font-bold text-champan">
                  {c.numero}.ª ronda
                </span>
              )}
              {empacar && (
                <span className="inline-flex items-center gap-1 rounded-full bg-aviso-fondo px-2.5 py-0.5 text-[13px] font-bold text-aviso">
                  <Package className="size-3.5" strokeWidth={2.4} />
                  EMPACAR{c.cliente_nombre ? ` · para ${c.cliente_nombre}` : ""}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className={`font-display text-[28px] font-semibold leading-none tabular-nums ${cronometro}`}>
            {reloj(ahora - (c.estado === "lista" && c.desde.lista ? c.desde.lista : c.desde.creada))}
          </p>
          <p className="mt-1 text-xs text-tenue">
            {c.estado === "lista" ? "esperando al mesero" : c.desde.iniciada ? `en fuego ${reloj(ahora - c.desde.iniciada)}` : "sin empezar"}
          </p>
        </div>
      </header>

      <ul className="mt-3 flex flex-col gap-2 px-3">
        {c.detalles.map((d) => {
          const listo = d.estado_preparacion === "listo" || d.estado_preparacion === "entregado";
          const contenido = (
            <>
              <span
                className={`grid min-w-11 shrink-0 place-items-center self-stretch rounded-xl font-display text-[22px] font-semibold tabular-nums ${
                  listo ? "bg-exito/15 text-exito" : "bg-arena text-espresso"
                }`}
              >
                {d.cantidad}
              </span>
              <span className="min-w-0 flex-1 py-0.5">
                <span className={`block text-[18px] font-semibold leading-snug ${listo ? "text-tenue line-through" : "text-espresso"}`}>
                  {d.nombre}
                </span>
                {d.nota && (
                  <span className={`mt-1 block w-fit rounded-lg px-2 py-0.5 text-[15px] font-semibold ${listo ? "text-tenue" : "bg-aviso-fondo text-aviso"}`}>
                    {d.nota}
                  </span>
                )}
              </span>
              {tocable && (
                <span
                  aria-hidden
                  className={`grid size-11 shrink-0 place-items-center self-center rounded-xl border-2 transition-colors ${
                    listo ? "border-exito bg-exito text-marfil" : "border-linea-fuerte bg-marfil text-transparent"
                  }`}
                >
                  <Check className="size-6" strokeWidth={3} />
                </span>
              )}
            </>
          );
          const base = "flex w-full items-stretch gap-3 rounded-2xl border-2 p-2 text-left";
          return (
            <li key={d.id}>
              {tocable ? (
                // Toda la fila es el botón: se toca con el nudillo o la muñeca.
                <button
                  type="button"
                  onClick={() => cocina.marcarItem(c.id, d.id, !listo)}
                  aria-pressed={listo}
                  aria-label={`${d.cantidad} ${d.nombre}${d.nota ? `, ${d.nota}` : ""}: ${listo ? "listo, tocar para desmarcar" : "marcar como listo"}`}
                  className={`${base} min-h-16 transition-colors active:scale-[0.99] ${
                    listo ? "border-exito/30 bg-exito-fondo" : "border-linea bg-marfil active:bg-arena"
                  }`}
                >
                  {contenido}
                </button>
              ) : (
                <div className={`${base} border-transparent`}>{contenido}</div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="px-4 pb-4 pt-3">
        {tocable && total > 1 && (
          <p className="mb-2 text-center text-sm text-suave">
            <b className="text-espresso tabular-nums">{hechos} de {total}</b> listos · toca cada producto o todo de una vez
          </p>
        )}
        {c.estado === "pendiente" && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => hacer(() => cocina.iniciar(c.id))}
            className="h-14 w-full rounded-xl bg-salvia text-[17px] font-semibold text-marfil active:bg-salvia-osc disabled:opacity-60"
          >
            Empezar
          </button>
        )}
        {c.estado === "en_preparacion" && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => hacer(() => cocina.marcarLista(c.id))}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-salvia text-[17px] font-semibold text-marfil active:bg-salvia-osc disabled:opacity-60"
          >
            <BellRing className="size-5" />
            {hechos === total ? "Avisar al mesero" : "Todo listo · avisar al mesero"}
          </button>
        )}
        {c.estado === "lista" && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => hacer(() => cocina.entregar(c.id))}
            className="h-14 w-full rounded-xl border border-linea-fuerte bg-marfil text-[17px] font-semibold text-espresso active:bg-arena disabled:opacity-60"
          >
            Ya se entregó
          </button>
        )}
        {mesero && <p className="mt-2 text-center text-[13px] text-tenue">Atiende {mesero}</p>}
      </div>
    </article>
  );
}

/** Pantalla completa (tablets Android y computadoras; el iPhone no lo permite). */
function usePantallaCompleta() {
  const disponible = typeof document !== "undefined" && !!document.documentElement.requestFullscreen;
  const [activa, setActiva] = useState(() => typeof document !== "undefined" && !!document.fullscreenElement);
  useEffect(() => {
    const cambio = () => setActiva(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", cambio);
    return () => document.removeEventListener("fullscreenchange", cambio);
  }, []);
  const alternar = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  };
  return { disponible, activa, alternar };
}

/** Que la tablet de cocina no se apague mientras el tablero está abierto. */
function useMantenerPantallaEncendida() {
  useEffect(() => {
    type WakeLock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLock> } };
    if (!nav.wakeLock) return;
    let lock: WakeLock | null = null;
    const pedir = () => {
      if (document.visibilityState === "visible") nav.wakeLock!.request("screen").then((l) => { lock = l; }).catch(() => {});
    };
    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      document.removeEventListener("visibilitychange", pedir);
      lock?.release().catch(() => {});
    };
  }, []);
}
