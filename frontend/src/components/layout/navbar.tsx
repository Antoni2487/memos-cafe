import { useLocation } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Bell, ShoppingBag, Receipt, Menu, Check } from "lucide-react";
import authService from "../../services/authService";
import { useReloj } from "../../hooks/useReloj";
import useStaffSocket from "../../hooks/useStaffSocket";
import api from "../../services/api";
import ordenesService from "../../services/ordenesService";
import type { Alerta } from "../../types";

// Alertas en vivo (plato listo / pidió la cuenta) además llevan un id
// propio para poder quitarlas de la lista tras una acción, y opcionalmente
// la referencia al ítem para que el mesero lo marque "entregado" desde acá.
interface AlertaLocal extends Alerta {
  id?: string;
  accion?: { ordenId: number; detalleId: number };
}

// Mapeo de ruta → título de página
const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/mesas": "Mesas",
  "/ordenes": "Órdenes",
  "/caja": "Caja",
  "/productos": "Productos",
  "/promociones": "Promociones",
  "/insumos": "Insumos",
  "/reportes": "Reportes",
  "/usuarios": "Usuarios",
  "/roles": "Roles y Permisos",
};

const ICONO_CONFIG: Record<string, { color: string; bg: string }> = {
  caja: { color: "#2C5545", bg: "rgba(44,85,69,0.1)" },
  orden: { color: "#1565c0", bg: "rgba(21,101,192,0.1)" },
  venta: { color: "#C9A84C", bg: "rgba(201,168,76,0.1)" },
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

interface NavbarProps {
  onMenuClick?: () => void;
}

export default function Navbar({ onMenuClick }: NavbarProps) {
  const location = useLocation();
  const user = authService.getUser();
  const ahora = useReloj();
  const esAdmin = user?.roles?.includes("admin");
  const esMesero = user?.roles?.includes("mesero");
  const esCajero = user?.roles?.includes("cajero");
  const puedeVerCampana = esAdmin || esMesero || esCajero;
  const titulo = PAGE_TITLES[location.pathname] || "Memo's Café";

  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [alertasListo, setAlertasListo] = useState<AlertaLocal[]>([]);
  const [entregando, setEntregando] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [ultimaLectura, setUltimaLectura] = useState(
    () => localStorage.getItem("notif_ultima_lectura") ?? new Date().toISOString()
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  const initials = user?.nombre
    ? user.nombre.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
    : "U";

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
  // "plato listo": solo le importa al mesero (quien lo lleva a la mesa).
  // "pidió la cuenta": le importa a mesero Y cajero — según el método de
  // pago, cobra el cajero en caja o el mesero le lleva el POS a la mesa.
  // Al admin NO se le agregan acá: ya le llegan por el polling de
  // /alertas/, sumarlos también duplicaría la notificación.
  // Se guardan solo en memoria (no persisten, son avisos efímeros de turno).
  // Sin useCallback a propósito: useStaffSocket sincroniza esta función a
  // un ref en su propio efecto, así que una referencia nueva en cada
  // render (por leer esMesero/esCajero/esAdmin directo) es segura acá.
  const manejarEventoEnVivo = (evento: Record<string, unknown>) => {
    const mesa = evento.mesa_numero != null ? `Mesa ${evento.mesa_numero}` : "Para llevar";

    if (evento.type === "detalle.actualizado" && (esMesero || esAdmin)) {
      setAlertasListo((prev) => [
        {
          id: crypto.randomUUID(),
          icono: "orden",
          mensaje: `${evento.nombre} listo — ${mesa}`,
          fecha: new Date().toISOString(),
          accion: {
            ordenId: Number(evento.orden_id),
            detalleId: Number(evento.detalle_id),
          },
        },
        ...prev,
      ].slice(0, 20));
      return;
    }

    if (evento.type === "solicitud_cobro.nueva" && (esMesero || esCajero)) {
      const metodo = String(evento.metodo_pago_sugerido ?? "");
      const metodoLabel = metodo.charAt(0).toUpperCase() + metodo.slice(1);
      setAlertasListo((prev) => [
        { id: crypto.randomUUID(), icono: "caja", mensaje: `${mesa} pidió la cuenta — ${metodoLabel}`, fecha: new Date().toISOString() },
        ...prev,
      ].slice(0, 20));
    }
  };

  // ── El mesero marca "entregado" directo desde la notificación ───────────
  const marcarEntregado = async (alerta: AlertaLocal) => {
    if (!alerta.accion || !alerta.id) return;
    setEntregando(alerta.id);
    try {
      await ordenesService.actualizarEstadoPreparacion(
        alerta.accion.ordenId, alerta.accion.detalleId, "entregado"
      );
      setAlertasListo((prev) => prev.filter((a) => a.id !== alerta.id));
    } catch {
      // se queda en la lista — el mesero puede reintentar
    } finally {
      setEntregando(null);
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

  // Fusiona el feed polleado (admin) con los avisos de "plato listo" en
  // vivo (admin + mesero), más recientes primero.
  const alertasCombinadas: AlertaLocal[] = [...alertasListo, ...alertas].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  // Solo cuentan las alertas POSTERIORES al último timestamp
  const noLeidas = alertasCombinadas.filter(
    (a) => new Date(a.fecha) > new Date(ultimaLectura)
  ).length;

  return (
    <header
      className="flex items-center justify-between px-3 sm:px-5 md:px-8 shrink-0"
      style={{
        backgroundColor: "#F8F4EE",
        borderBottom: "1px solid rgba(44,85,69,0.12)",
        height: "64px",
        position: "relative",
        zIndex: 100,
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {/* Hamburguesa — solo móvil */}
        <button
          onClick={onMenuClick}
          className="md:hidden rounded-lg flex items-center justify-center shrink-0"
          style={{ width: 36, height: 36, backgroundColor: "rgba(44,85,69,0.08)" }}
        >
          <Menu size={19} strokeWidth={1.8} style={{ color: "#2C5545" }} />
        </button>

        <h1
          className="truncate"
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "22px",
            fontWeight: 600,
            color: "#2C5545",
            lineHeight: 1,
            margin: 0,
          }}
        >
          {titulo}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Fecha y hora — se oculta en móvil, se compacta en tablet */}
        <div className="text-right hidden sm:block">
          <p
            className="hidden md:block"
            style={{ fontFamily: "'Lato', sans-serif", fontSize: 12.5, color: "#2C5545", fontWeight: 500, margin: 0, textTransform: "capitalize" }}
          >
            {ahora.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <p style={{ fontFamily: "'Lato', sans-serif", fontSize: 11.5, color: "rgba(44,85,69,0.6)", margin: 0 }}>
            <span className="hidden md:inline">Lima, Perú — </span>
            {ahora.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true })}
          </p>
        </div>

        {/* ── Campana ── */}
        {puedeVerCampana && (
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => {
                const next = !abierto;
                setAbierto(next);
                if (next) marcarTodasLeidas();
              }}
              className="relative rounded-full items-center justify-center hidden xs:flex sm:flex"
              style={{ width: 38, height: 38, backgroundColor: "rgba(44,85,69,0.07)", border: "none", cursor: "pointer" }}
            >
              <Bell size={17} strokeWidth={1.8} style={{ color: "#2C5545" }} />
              {noLeidas > 0 && (
                <span style={{
                  position: "absolute", top: 6, right: 6,
                  width: 16, height: 16, borderRadius: "50%",
                  backgroundColor: "#c62828", color: "white",
                  fontFamily: "'Lato', sans-serif", fontSize: 9,
                  fontWeight: 700, display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}>
                  {noLeidas > 9 ? "9+" : noLeidas}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {abierto && (
              <div style={{
                position: "absolute", top: 46, right: 0,
                width: 340, backgroundColor: "white",
                borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.14)",
                border: "1px solid rgba(44,85,69,0.1)",
                overflow: "hidden", zIndex: 200,
              }}>
                <div style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid rgba(44,85,69,0.08)",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 14, fontWeight: 600, color: "#2C5545" }}>
                    Notificaciones
                  </span>
                  <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: "rgba(44,85,69,0.5)" }}>
                    {esAdmin ? "Últimas 8 horas" : "En vivo"}
                  </span>
                </div>

                <div style={{ maxHeight: 380, overflowY: "auto" }}>
                  {alertasCombinadas.length === 0 ? (
                    <div style={{
                      padding: "32px 16px", textAlign: "center",
                      fontFamily: "'Lato', sans-serif", fontSize: 13,
                      color: "rgba(44,85,69,0.4)",
                    }}>
                      Sin notificaciones recientes
                    </div>
                  ) : (
                    alertasCombinadas.map((alerta, i) => {
                      const cfg = ICONO_CONFIG[alerta.icono] ?? ICONO_CONFIG.orden;
                      const leida = new Date(alerta.fecha) <= new Date(ultimaLectura);
                      return (
                        <div key={alerta.id ?? i} style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid rgba(44,85,69,0.06)",
                          display: "flex", alignItems: "flex-start", gap: 10,
                          backgroundColor: leida ? "white" : "rgba(44,85,69,0.025)",
                        }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            backgroundColor: cfg.bg, flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {alerta.icono === "orden" && <ShoppingBag size={14} color={cfg.color} />}
                            {alerta.icono === "venta" && <Receipt size={14} color={cfg.color} />}
                            {alerta.icono === "caja" && <span style={{ fontSize: 14 }}>💰</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              fontFamily: "'Lato', sans-serif", fontSize: 12.5,
                              fontWeight: leida ? 400 : 600,
                              color: "#333", margin: 0, lineHeight: 1.4,
                            }}>
                              {alerta.mensaje}
                            </p>
                            <p style={{
                              fontFamily: "'Lato', sans-serif", fontSize: 11,
                              color: "rgba(44,85,69,0.5)", margin: "2px 0 0 0",
                            }}>
                              {formatHora(alerta.fecha)}
                            </p>
                          </div>
                          {alerta.accion && (esMesero || esAdmin) && (
                            <button
                              onClick={() => marcarEntregado(alerta)}
                              disabled={entregando === alerta.id}
                              className="shrink-0 flex items-center gap-1 rounded-md"
                              style={{
                                padding: "4px 8px", border: "1px solid rgba(44,85,69,0.25)",
                                backgroundColor: "white", color: "#2C5545",
                                fontFamily: "'Lato', sans-serif", fontSize: 10.5, fontWeight: 700,
                                cursor: entregando === alerta.id ? "not-allowed" : "pointer",
                              }}
                            >
                              <Check size={11} strokeWidth={2.5} />
                              {entregando === alerta.id ? "..." : "Entregado"}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chip del usuario — nombre se oculta en móvil, solo avatar */}
        <div className="flex items-center gap-2 rounded-full px-2 sm:px-3 py-1.5" style={{ backgroundColor: "#2C5545" }}>
          <div
            className="rounded-full flex items-center justify-center shrink-0"
            style={{ width: 22, height: 22, backgroundColor: "#1E4A37", fontFamily: "'Lato', sans-serif", fontSize: 10, fontWeight: 700, color: "white" }}
          >
            {initials}
          </div>
          <span
            className="hidden sm:inline"
            style={{ fontFamily: "'Lato', sans-serif", fontSize: 12.5, fontWeight: 500, color: "white" }}
          >
            {user?.nombre?.split(" ")[0] || "Usuario"}
          </span>
        </div>
      </div>
    </header>
  );
}
