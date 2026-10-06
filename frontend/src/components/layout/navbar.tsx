import { useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Bell, ShoppingBag, Receipt, Wallet } from "lucide-react";
import authService from "../../services/authService";
import { useReloj } from "../../hooks/useReloj";
import useStaffSocket from "../../hooks/useStaffSocket";
import api from "../../services/api";
import { sonarAviso } from "../../utils/sonido";
import type { Alerta } from "../../types";
import { tituloDeRuta } from "./navegacion";
import { Marca } from "./sidebar";

// Las alertas en vivo (pidió la cuenta) llevan un id propio para la lista.
interface AlertaLocal extends Alerta {
  id?: string;
}

const ICONO_CONFIG: Record<string, { color: string; bg: string }> = {
  caja: { color: "var(--salvia-osc)", bg: "var(--salvia-clara)" },
  orden: { color: "var(--info)", bg: "var(--info-fondo)" },
  venta: { color: "var(--champan)", bg: "var(--champan-claro)" },
};

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-PE", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

// ── Inicializa el timestamp UNA sola vez cuando el módulo se carga ──────────
if (!localStorage.getItem("notif_ultima_lectura")) {
  localStorage.setItem("notif_ultima_lectura", new Date().toISOString());
}

export default function Navbar() {
  const location = useLocation();
  const user = authService.getUser();
  const ahora = useReloj();
  const esAdmin = user?.roles?.includes("admin");
  const esMesero = user?.roles?.includes("mesero");
  const esCajero = user?.roles?.includes("cajero");
  const puedeVerCampana = esAdmin || esMesero || esCajero;
  const titulo = tituloDeRuta(location.pathname);
  const fecha = ahora.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  const fechaLarga = fecha.charAt(0).toUpperCase() + fecha.slice(1);
  const hora = ahora.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true });

  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [alertasEnVivo, setAlertasEnVivo] = useState<AlertaLocal[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [ultimaLectura, setUltimaLectura] = useState(
    () => localStorage.getItem("notif_ultima_lectura") ?? new Date().toISOString()
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Polling cada 30 segundos ──────────────────────────────────────────────
  useEffect(() => {
    if (!esAdmin) return;
    // setAlertas solo dentro del callback de la promesa
    // (react-hooks/set-state-in-effect).
    const cargarAlertas = () => {
      api.get<Alerta[]>("/alertas/")
        .then(({ data }) => setAlertas(data))
        .catch(() => { /* silencioso */ });
    };
    cargarAlertas();
    const iv = setInterval(cargarAlertas, 30000);
    return () => clearInterval(iv);
  }, [esAdmin]);

  // ── Avisos en vivo por ws/meseros/ ──────────────────────────────────────
  // "Pidió más por QR": la ronda ya fue a cocina; el mesero solo se entera.
  // "Pidió la cuenta": le importa a mesero Y cajero — según el método de
  // pago, cobra el cajero en caja o el mesero le lleva el POS a la mesa.
  // "Listo para servir" NO va acá: tiene su propia tarjeta con timbre
  // arriba de la pantalla (ver ListosParaServir).
  // Al admin no se le agregan: ya le llegan por el polling de /alertas/.
  // Se guardan solo en memoria (avisos efímeros de turno).
  // Sin useCallback a propósito: useStaffSocket sincroniza esta función a
  // un ref en su propio efecto.
  const manejarEventoEnVivo = (evento: Record<string, unknown>) => {
    // Una mesa ya atendida pidió algo más por QR: va directo a cocina, pero
    // el mesero se entera (por si quiere pasar a verla).
    if (evento.type === "pedido.ronda_qr" && esMesero) {
      sonarAviso();
      setAlertasEnVivo((prev) => [
        {
          id: crypto.randomUUID(),
          icono: "orden",
          mensaje: `Mesa ${evento.mesa_numero} pidió más por QR: ${evento.resumen}. Ya está en cocina.`,
          fecha: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 20));
      return;
    }

    if (evento.type === "solicitud_cobro.nueva" && (esMesero || esCajero)) {
      const metodo = String(evento.metodo_pago_sugerido ?? "");
      const metodoLabel = metodo ? metodo.charAt(0).toUpperCase() + metodo.slice(1) : "";
      sonarAviso();
      setAlertasEnVivo((prev) => [
        {
          id: crypto.randomUUID(),
          icono: "caja",
          mensaje: `Mesa ${evento.mesa_numero ?? "?"} pidió la cuenta${metodoLabel ? ` · quiere pagar con ${metodoLabel}` : ""}`,
          fecha: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 20));
    }
  };

  useStaffSocket("meseros", manejarEventoEnVivo, puedeVerCampana);

  // ── Cerrar al hacer clic fuera ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setAbierto(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Marcar todas como leídas ──────────────────────────────────────────────
  const marcarTodasLeidas = () => {
    const ts = new Date().toISOString();
    setUltimaLectura(ts);
    localStorage.setItem("notif_ultima_lectura", ts);
  };

  // Fusiona el feed polleado (admin) con los avisos en vivo, más recientes
  // primero.
  const alertasCombinadas: AlertaLocal[] = [...alertasEnVivo, ...alertas].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  // Solo cuentan las alertas POSTERIORES al último timestamp
  const noLeidas = alertasCombinadas.filter(
    (a) => new Date(a.fecha) > new Date(ultimaLectura)
  ).length;

  return (
    <header className="relative z-30 flex h-14 md:h-16 shrink-0 items-center justify-between gap-3 border-b border-linea bg-beige/95 backdrop-blur px-4 md:px-6 lg:px-8"
      style={{ paddingTop: "env(safe-area-inset-top)", boxSizing: "content-box" }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {/* En el celular no hay menú lateral: el logo orienta, como en una app */}
        {/* En el celular hace de barra de app (logo + sección). En pantallas
            grandes la sección ya la dice el menú lateral y el encabezado de
            la página: aquí va la fecha, para no repetir el título. */}
        <span className="md:hidden"><Marca compacta /></span>
        <h1 className="md:hidden truncate font-display text-xl font-semibold text-espresso leading-none">
          {titulo}
        </h1>
        <p className="hidden md:block text-sm text-suave">
          <span className="font-medium text-espresso">{fechaLarga}</span>
          <span className="mx-2 text-linea-fuerte">·</span>
          <span className="tabular-nums">{hora}</span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3 md:gap-5">
        <span className="hidden sm:block md:hidden text-xs text-suave tabular-nums">{hora}</span>

        {puedeVerCampana && (
          <div ref={dropdownRef} className="relative">
            <button
              type="button"
              onClick={() => {
                const next = !abierto;
                setAbierto(next);
                if (next) marcarTodasLeidas();
              }}
              aria-label={noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer` : "Notificaciones"}
              aria-expanded={abierto}
              className="relative grid size-10 place-items-center rounded-full border border-linea bg-marfil text-espresso transition-colors hover:bg-arena"
            >
              <Bell className="size-4.5" strokeWidth={1.8} />
              {noLeidas > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid min-w-5 h-5 place-items-center rounded-full bg-peligro px-1 text-[10px] font-bold text-marfil ring-2 ring-beige">
                  {noLeidas > 9 ? "9+" : noLeidas}
                </span>
              )}
            </button>

            {abierto && (
              <div className="fixed inset-x-3 top-[calc(3.5rem+env(safe-area-inset-top)+8px)] md:absolute md:inset-x-auto md:right-0 md:top-12 md:w-90 overflow-hidden rounded-2xl border border-linea bg-marfil shadow-alta">
                <div className="flex items-center justify-between border-b border-linea px-4 py-3">
                  <span className="font-display text-[15px] font-semibold text-espresso">Notificaciones</span>
                  <span className="text-xs text-suave">{esAdmin ? "Últimas 8 horas" : "En vivo"}</span>
                </div>

                <div className="max-h-[60vh] md:max-h-96 overflow-y-auto">
                  {alertasCombinadas.length === 0 ? (
                    <div className="px-4 py-10 text-center text-sm text-suave">
                      Todo tranquilo por ahora
                    </div>
                  ) : (
                    alertasCombinadas.map((alerta, i) => {
                      const cfg = ICONO_CONFIG[alerta.icono] ?? ICONO_CONFIG.orden;
                      const leida = new Date(alerta.fecha) <= new Date(ultimaLectura);
                      return (
                        <div
                          key={alerta.id ?? i}
                          className={`flex items-start gap-3 border-b border-linea/70 px-4 py-3 last:border-b-0 ${leida ? "" : "bg-salvia-clara/40"}`}
                        >
                          <span className="grid size-8 shrink-0 place-items-center rounded-full" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                            {alerta.icono === "orden" && <ShoppingBag className="size-3.5" />}
                            {alerta.icono === "venta" && <Receipt className="size-3.5" />}
                            {alerta.icono === "caja" && <Wallet className="size-3.5" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={`text-[13px] leading-snug text-espresso ${leida ? "" : "font-semibold"}`}>
                              {alerta.mensaje}
                            </p>
                            <p className="mt-0.5 text-xs text-suave">{formatHora(alerta.fecha)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
