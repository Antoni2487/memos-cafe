import { useEffect, useState, type ReactNode, type CSSProperties, type ComponentType } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ClipboardList,
  Receipt,
  Table2,
  TrendingUp,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import dashboardService from "../../services/dashboardService";
import { LoadingSpinner, EmptyState } from "../../components/common";
import { useIsMobile } from "../../hooks/useMediaQuery";
import type { DashboardCajaActiva, DashboardData, DashboardMesas } from "../../types";

// --- Paleta de colores del proyecto ---
const VERDE         = "#2C5545";
const VERDE_CLARO   = "rgba(44,85,69,0.08)";
const DORADO        = "#C9A84C";

const METODO_COLORES: Record<string, string> = {
  efectivo: "#2C5545",
  tarjeta:  "#C9A84C",
  yape:     "#6B4FA0",
  plin:     "#0EA5E9",
};

const METODO_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta:  "Tarjeta",
  yape:     "Yape",
  plin:     "Plin",
};

// --- Formateadores ---
const formatSoles = (v: number | string) =>
  `S/ ${Number(v).toLocaleString("es-PE", { minimumFractionDigits: 2 })}`;

const formatFecha = (str: string) => {
  if (!str) return "";
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
};

interface TooltipPayloadItem {
  value?: number | string;
}

interface TooltipVentasProps {
  active?: boolean;
  payload?: readonly TooltipPayloadItem[];
  label?: ReactNode;
}

// --- Tooltip personalizado para el area chart ---
function TooltipVentas({ active, payload, label }: TooltipVentasProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        backgroundColor: "white",
        border: "1px solid rgba(44,85,69,0.15)",
        borderRadius: 8,
        padding: "10px 14px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
      }}
    >
      <p style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: VERDE, fontWeight: 700, margin: "0 0 4px" }}>
        {label}
      </p>
      <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, color: VERDE, margin: 0, fontWeight: 600 }}>
        {formatSoles(payload[0]?.value ?? 0)}
      </p>
      <p style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: "rgba(44,85,69,0.6)", margin: "2px 0 0" }}>
        {payload[1]?.value ?? 0} órdenes
      </p>
    </div>
  );
}

interface KPICardProps {
  titulo: string;
  valor: ReactNode;
  subtitulo?: string;
  icono: ComponentType<{ size?: number; strokeWidth?: number }>;
  acento?: boolean;
  delay?: number;
}

// --- Tarjeta KPI ---
function KPICard({ titulo, valor, subtitulo, icono: Icono, acento = false, delay = 0 }: KPICardProps) {
  return (
    <div
      className="flex flex-col justify-between"
      style={{
        backgroundColor: acento ? VERDE : "white",
        borderRadius: 14,
        padding: "20px 22px",
        border: acento ? "none" : `1px solid rgba(201,168,76,0.2)`,
        boxShadow: acento
          ? `0 8px 32px rgba(44,85,69,0.25)`
          : `0 2px 12px rgba(44,85,69,0.06)`,
        animation: `fadeUp 0.4s ease both`,
        animationDelay: `${delay}ms`,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <p
          style={{
            fontFamily: "'Lato', sans-serif",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: acento ? "rgba(255,255,255,0.65)" : "rgba(44,85,69,0.6)",
            margin: 0,
          }}
        >
          {titulo}
        </p>
        <div
          style={{
            width: 36, height: 36, borderRadius: 9,
            backgroundColor: acento ? "rgba(255,255,255,0.12)" : VERDE_CLARO,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: acento ? "white" : VERDE,
          }}
        >
          <Icono size={17} strokeWidth={1.8} />
        </div>
      </div>
      <div>
        <p
          style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 28,
            fontWeight: 600,
            color: acento ? "white" : VERDE,
            margin: "0 0 4px",
            lineHeight: 1,
          }}
        >
          {valor ?? "—"}
        </p>
        {subtitulo && (
          <p
            style={{
              fontFamily: "'Lato', sans-serif",
              fontSize: 12,
              color: acento ? "rgba(255,255,255,0.55)" : "rgba(44,85,69,0.55)",
              margin: 0,
            }}
          >
            {subtitulo}
          </p>
        )}
      </div>
    </div>
  );
}

interface CardProps {
  titulo?: string;
  children: ReactNode;
  accion?: ReactNode;
  style?: CSSProperties;
}

// --- Card generica ---
function Card({ titulo, children, accion, style = {} }: CardProps) {
  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: 14,
        border: "1px solid rgba(44,85,69,0.1)",
        boxShadow: "0 2px 12px rgba(44,85,69,0.06)",
        overflow: "hidden",
        ...style,
      }}
    >
      {titulo && (
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(44,85,69,0.07)" }}
        >
          <h3
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 15,
              fontWeight: 600,
              color: VERDE,
              margin: 0,
            }}
          >
            {titulo}
          </h3>
          {accion}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

// --- Estado de mesas visual ---
function MesasWidget({ mesas }: { mesas?: DashboardMesas }) {
  if (!mesas) return null;
  const items = [
    { label: "Libres",    valor: mesas.libres,    color: "#2e7d32", bg: "#e8f5e9" },
    { label: "Ocupadas",  valor: mesas.ocupadas,  color: "#c62828", bg: "#fdecea" },
    { label: "Reservadas",valor: mesas.reservadas,color: "#f57f17", bg: "#fff8e1" },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "rgba(44,85,69,0.6)" }}>
          Total: {mesas.total} mesas
        </span>
        <div className="flex rounded-full overflow-hidden" style={{ width: 100, height: 6 }}>
          {items.map((it) => (
            <div
              key={it.label}
              style={{
                width: `${mesas.total > 0 ? (it.valor / mesas.total) * 100 : 0}%`,
                backgroundColor: it.color,
                transition: "width 0.6s ease",
              }}
            />
          ))}
        </div>
      </div>
      {items.map((it) => (
        <div key={it.label} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: it.color }} />
            <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#444" }}>
              {it.label}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 17,
                fontWeight: 600,
                color: VERDE,
              }}
            >
              {it.valor}
            </span>
            <span
              style={{
                fontFamily: "'Lato', sans-serif",
                fontSize: 10,
                color: it.color,
                backgroundColor: it.bg,
                padding: "1px 7px",
                borderRadius: 999,
                fontWeight: 600,
              }}
            >
              {mesas.total > 0 ? Math.round((it.valor / mesas.total) * 100) : 0}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Caja activa widget ---
function CajaWidget({ caja }: { caja?: DashboardCajaActiva | null }) {
  if (!caja) return (
    <div className="flex flex-col items-center justify-center py-6 gap-2">
      <AlertCircle size={28} style={{ color: "rgba(44,85,69,0.3)" }} strokeWidth={1.5} />
      <p style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "rgba(44,85,69,0.5)", margin: 0 }}>
        No hay caja abierta
      </p>
    </div>
  );

  const apertura = new Date(caja.fecha_apertura).toLocaleTimeString("es-PE", {
    hour: "2-digit", minute: "2-digit", hour12: true,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div
          style={{
            width: 8, height: 8, borderRadius: "50%",
            backgroundColor: "#2e7d32",
            boxShadow: "0 0 0 3px rgba(46,125,50,0.2)",
          }}
        />
        <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#2e7d32", fontWeight: 600 }}>
          Turno activo desde {apertura}
        </span>
      </div>

      <div
        style={{
          backgroundColor: VERDE_CLARO,
          borderRadius: 10,
          padding: "12px 14px",
        }}
      >
        <p style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: "rgba(44,85,69,0.6)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
          Cajero
        </p>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600, color: VERDE, margin: 0 }}>
          {caja.cajero}
        </p>
      </div>

      <div className="flex gap-3">
        <div style={{ flex: 1, backgroundColor: VERDE_CLARO, borderRadius: 10, padding: "12px 14px" }}>
          <p style={{ fontFamily: "'Lato', sans-serif", fontSize: 10, color: "rgba(44,85,69,0.6)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
            Monto inicial
          </p>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600, color: VERDE, margin: 0 }}>
            {formatSoles(caja.monto_inicial)}
          </p>
        </div>
        <div style={{ flex: 1, backgroundColor: VERDE_CLARO, borderRadius: 10, padding: "12px 14px" }}>
          <p style={{ fontFamily: "'Lato', sans-serif", fontSize: 10, color: "rgba(44,85,69,0.6)", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700 }}>
            Ventas turno
          </p>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600, color: VERDE, margin: 0 }}>
            {formatSoles(caja.ventas_turno)}
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Pagina principal ---
export default function DashboardPage() {
  const isMobile = useIsMobile();
  const [data, setData]       = useState<DashboardData | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);

  const cargar = async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    else setRecargando(true);
    setError(null);
    try {
      const res = await dashboardService.getDashboard();
      setData(res);
    } catch {
      setError("No se pudo cargar el dashboard.");
    } finally {
      setCargando(false);
      setRecargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  if (cargando) return <LoadingSpinner texto="Cargando dashboard..." full />;

  if (error) return (
    <EmptyState
      titulo="Error al cargar"
      subtitulo={error}
      accion={
        <button
          onClick={() => cargar()}
          style={{
            backgroundColor: VERDE, color: "white", border: "none",
            borderRadius: 8, padding: "9px 18px", cursor: "pointer",
            fontFamily: "'Lato', sans-serif", fontSize: 13, fontWeight: 600,
          }}
        >
          Reintentar
        </button>
      }
    />
  );

  const ventasPorDia = (data?.ventas_por_dia ?? []).map((d) => ({
    fecha:   formatFecha(d.fecha),
    total:   Number(d.total),
    ordenes: d.ordenes,
  }));

  const metodosPago = (data?.ventas_por_metodo ?? []).map((m) => ({
    name:  METODO_LABELS[m.metodo_pago] ?? m.metodo_pago,
    value: Number(m.total),
    color: METODO_COLORES[m.metodo_pago] ?? "#aaa",
  }));

  return (
    <>
  <style>{`
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `}</style>
  <div className="flex flex-col gap-5">

    <h2 style={{
    fontFamily: "'Playfair Display', serif",
    fontSize: "1.5rem",
    fontWeight: 600,
    color: "#2C5545",
    margin: 0,
  }}>
    Dashboard
  </h2>

    {/* Botón actualizar — sin fecha, ya está en el navbar */}
    <div className="flex justify-end">
      <button
        onClick={() => cargar(true)}
        disabled={recargando}
        className="flex items-center gap-2"
        style={{
          backgroundColor: VERDE_CLARO,
          border: "none", borderRadius: 8,
          padding: "7px 14px", cursor: recargando ? "not-allowed" : "pointer",
          fontFamily: "'Lato', sans-serif", fontSize: 12,
          color: VERDE, fontWeight: 600,
        }}
      >
        <RefreshCw
          size={13}
          strokeWidth={2}
          style={{ animation: recargando ? "spin 1s linear infinite" : "none" }}
        />
        Actualizar
      </button>
    </div>

        {/* Fila 1: KPIs */}
        <div className="grid grid-cols-2 gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <KPICard
            titulo="Ventas hoy"
            valor={formatSoles(data?.ventas?.total ?? 0)}
            subtitulo={`Ticket prom. ${formatSoles(data?.ventas?.ticket_promedio ?? 0)}`}
            icono={TrendingUp}
            acento
            delay={0}
          />
          <KPICard
            titulo="Ganancias del mes"
            valor={formatSoles(data?.ventas?.mes ?? 0)}
            icono={TrendingUp}
            delay={20}
          />
          <KPICard
            titulo="Ganancias del año"
            valor={formatSoles(data?.ventas?.anio ?? 0)}
            icono={TrendingUp}
            delay={40}
          />
          <KPICard
            titulo="Órdenes abiertas"
            valor={data?.ordenes?.abiertas ?? 0}
            subtitulo={`${data?.ordenes?.cerradas_hoy ?? 0} cerradas hoy`}
            icono={ClipboardList}
            delay={60}
          />
          <KPICard
            titulo="Mesas ocupadas"
            valor={data?.mesas?.ocupadas ?? 0}
            subtitulo={`${data?.mesas?.libres ?? 0} libres de ${data?.mesas?.total ?? 0}`}
            icono={Table2}
            delay={120}
          />
          <KPICard
            titulo="Órdenes cobradas"
            valor={data?.ordenes?.cerradas_hoy ?? 0}
            subtitulo={`${data?.ordenes?.anuladas_hoy ?? 0} anuladas hoy`}
            icono={Receipt}
            delay={180}
          />
        </div>

        {/* Fila 2: Grafico ventas + Metodos de pago */}
        <div className="grid gap-4" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr 340px" }}>

          <Card titulo="Ventas de los últimos días">
            {ventasPorDia.length === 0 ? (
              <div className="flex items-center justify-center" style={{ height: 200 }}>
                <p style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "rgba(44,85,69,0.4)" }}>
                  Sin datos de ventas aún
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={ventasPorDia} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradVerde" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={VERDE} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={VERDE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(44,85,69,0.08)" vertical={false} />
                  <XAxis
                    dataKey="fecha"
                    tick={{ fontFamily: "'Lato', sans-serif", fontSize: 11, fill: "rgba(44,85,69,0.5)" }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fontFamily: "'Lato', sans-serif", fontSize: 11, fill: "rgba(44,85,69,0.5)" }}
                    axisLine={false} tickLine={false}
                    tickFormatter={(v) => `S/${v}`}
                    width={55}
                  />
                  <Tooltip content={<TooltipVentas />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke={VERDE}
                    strokeWidth={2.5}
                    fill="url(#gradVerde)"
                    dot={{ fill: VERDE, r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: VERDE }}
                  />
                  <Area
                    type="monotone"
                    dataKey="ordenes"
                    stroke="transparent"
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card titulo="Métodos de pago">
            {metodosPago.length === 0 ? (
              <div className="flex items-center justify-center" style={{ height: 200 }}>
                <p style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "rgba(44,85,69,0.4)" }}>
                  Sin pagos registrados
                </p>
              </div>
            ) : (
              <div>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie
                      data={metodosPago}
                      cx="50%" cy="50%"
                      innerRadius={45}
                      outerRadius={68}
                      dataKey="value"
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {metodosPago.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => formatSoles(v)}
                      contentStyle={{
                        fontFamily: "'Lato', sans-serif", fontSize: 12,
                        borderRadius: 8, border: "1px solid rgba(44,85,69,0.15)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 mt-2">
                  {metodosPago.map((m) => (
                    <div key={m.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: m.color }} />
                        <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#444" }}>{m.name}</span>
                      </div>
                      <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, fontWeight: 600, color: VERDE }}>
                        {formatSoles(m.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* Fila 3: Top productos + Mesas + Caja activa */}
        <div className="grid gap-4" style={{ gridTemplateColumns: isMobile ? "1fr" : "1fr 260px 260px" }}>

          <Card titulo="Top productos hoy">
            {(data?.top_productos ?? []).length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <p style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "rgba(44,85,69,0.4)" }}>
                  Sin ventas registradas hoy
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {(data?.top_productos ?? []).map((p, i) => {
                  const max = data?.top_productos?.[0]?.cantidad ?? 1;
                  const pct = Math.round((p.cantidad / max) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span
                        style={{
                          fontFamily: "'Playfair Display', serif",
                          fontSize: 13, fontWeight: 600,
                          color: i === 0 ? DORADO : "rgba(44,85,69,0.4)",
                          width: 18, textAlign: "center",
                        }}
                      >
                        {i + 1}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div className="flex items-center justify-between mb-1">
                          <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#333" }}>
                            {p.nombre}
                          </span>
                          <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, fontWeight: 600, color: VERDE }}>
                            {p.cantidad} uds.
                          </span>
                        </div>
                        <div style={{ height: 4, backgroundColor: VERDE_CLARO, borderRadius: 999, overflow: "hidden" }}>
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              backgroundColor: i === 0 ? DORADO : VERDE,
                              borderRadius: 999,
                              transition: "width 0.6s ease",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card titulo="Estado de mesas">
            <MesasWidget mesas={data?.mesas} />
          </Card>

          <Card titulo="Caja activa">
            <CajaWidget caja={data?.caja_activa} />
          </Card>
        </div>

      </div>
    </>
  );
}
