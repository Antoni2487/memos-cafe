import { useState, type ReactNode, type ComponentType, type CSSProperties } from "react";
import { Download, TrendingUp, Package, Receipt } from "lucide-react";
import reporteService, { descargarBlob } from "../../services/reporteService";
import { getErrorMessage } from "../../utils/errors";
import type { ReporteCaja, ReporteProductos, ReporteVentas } from "../../types";

const COLOR = {
  verde:    "#2C5545",
  verdeOsc: "#1E4A37",
  verdePal: "rgba(44,85,69,0.08)",
  borde:    "rgba(44,85,69,0.12)",
  dorado:   "#C9A84C",
  rojo:     "#c62828",
};

// ── Helpers de fecha ──────────────────────────────────────────────────────────
const hoy = () => new Date().toISOString().split("T")[0];
const hace30 = () => {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
};

// ── Componentes base ──────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: ReactNode;
  sub?: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div style={{
      background: "white", border: `1.5px solid ${COLOR.borde}`,
      borderRadius: 12, padding: "16px 20px", flex: 1, minWidth: 140,
    }}>
      <p style={{
        fontFamily: "'Lato',sans-serif", fontSize: 11, fontWeight: 700,
        color: "rgba(44,85,69,0.6)", textTransform: "uppercase",
        letterSpacing: "0.07em", margin: "0 0 6px 0",
      }}>{label}</p>
      <p style={{
        fontFamily: "'Playfair Display',Georgia,serif",
        fontSize: 24, fontWeight: 700, color: COLOR.verde, margin: 0,
      }}>{value}</p>
      {sub && (
        <p style={{ fontFamily: "'Lato',sans-serif", fontSize: 12,
          color: "rgba(44,85,69,0.55)", margin: "4px 0 0 0" }}>{sub}</p>
      )}
    </div>
  );
}

interface TabBtnProps {
  activo: boolean;
  onClick: () => void;
  Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  children: ReactNode;
}

function TabBtn({ activo, onClick, Icon, children }: TabBtnProps) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "8px 16px", borderRadius: 8, border: "1px solid",
      borderColor: activo ? COLOR.verde : "rgba(44,85,69,0.2)",
      backgroundColor: activo ? COLOR.verde : "white",
      color: activo ? "white" : COLOR.verde,
      fontFamily: "'Lato',sans-serif", fontSize: 13, fontWeight: 600,
      cursor: "pointer",
    }}>
      <Icon size={14} strokeWidth={2} />
      {children}
    </button>
  );
}

function SeccionLabel({ children }: { children: ReactNode }) {
  return (
    <p style={{
      fontFamily: "'Lato',sans-serif", fontSize: 11, fontWeight: 700,
      color: "rgba(44,85,69,0.6)", textTransform: "uppercase",
      letterSpacing: "0.08em", margin: "0 0 10px 0",
    }}>{children}</p>
  );
}

interface TablaProps {
  headers: string[];
  rows: ReactNode[][];
}

function Tabla({ headers, rows }: TablaProps) {
  return (
    <div style={{ background: "white", border: `1.5px solid ${COLOR.borde}`,
      borderRadius: 12, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: COLOR.verdePal }}>
            {headers.map(h => (
              <th key={h} style={estilos.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} style={{
                ...estilos.td, textAlign: "center", color: "#999", padding: 24,
              }}>
                Sin datos en este período
              </td>
            </tr>
          ) : rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${COLOR.borde}` }}>
              {row.map((cell, j) => (
                <td key={j} style={estilos.td}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
type TabId = "ventas" | "productos" | "caja";

const TABS: { id: TabId; label: string; Icon: ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { id: "ventas",    label: "Ventas",    Icon: TrendingUp },
  { id: "productos", label: "Productos", Icon: Package    },
  { id: "caja",      label: "Caja",      Icon: Receipt    },
];

// ── Página principal ──────────────────────────────────────────────────────────
export default function ReportesPage() {
  const [tab,          setTab]          = useState<TabId>("ventas");
  const [fechaInicio,  setFechaInicio]  = useState(hace30());
  const [fechaFin,     setFechaFin]     = useState(hoy());
  const [cargando,     setCargando]     = useState(false);
  const [exportando,   setExportando]   = useState(false);
  const [error,        setError]        = useState("");
  const [dataVentas,   setDataVentas]   = useState<ReporteVentas | null>(null);
  const [dataProductos,setDataProductos]= useState<ReporteProductos | null>(null);
  const [dataCaja,     setDataCaja]     = useState<ReporteCaja | null>(null);

  const handleConsultar = async () => {
    if (!fechaInicio || !fechaFin) return;
    setCargando(true);
    setError("");
    try {
      const params = { fecha_inicio: fechaInicio, fecha_fin: fechaFin };
      if (tab === "ventas") {
        const { data } = await reporteService.getVentas(params);
        setDataVentas(data);
      } else if (tab === "productos") {
        const { data } = await reporteService.getProductos(params);
        setDataProductos(data);
      } else {
        const { data } = await reporteService.getCaja(params);
        setDataCaja(data);
      }
    } catch (e) {
      setError(getErrorMessage(e, "Error al consultar el reporte."));
    } finally {
      setCargando(false);
    }
  };

  const handleExportar = async () => {
    setExportando(true);
    setError("");
    try {
      const params = { fecha_inicio: fechaInicio, fecha_fin: fechaFin };
      let res, nombre;
      if (tab === "ventas") {
        res = await reporteService.exportarVentas(params);
        nombre = `reporte_ventas_${fechaInicio}_${fechaFin}.xlsx`;
      } else if (tab === "productos") {
        res = await reporteService.exportarProductos(params);
        nombre = `reporte_productos_${fechaInicio}_${fechaFin}.xlsx`;
      } else {
        res = await reporteService.exportarCaja(params);
        nombre = `reporte_caja_${fechaInicio}_${fechaFin}.xlsx`;
      }
      descargarBlob(res.data, nombre);
    } catch {
      setError("Error al exportar. Intenta nuevamente.");
    } finally {
      setExportando(false);
    }
  };

  const cambiarTab = (id: TabId) => {
    setTab(id);
    setError("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Encabezado */}
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", borderBottom: `1px solid ${COLOR.borde}`, paddingBottom: 16 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "1.5rem",
            fontWeight: 600, color: COLOR.verde, margin: 0 }}>Reportes</h2>
          <p style={{ fontFamily: "'Lato',sans-serif", fontSize: 13,
            color: "rgba(44,85,69,0.6)", margin: "4px 0 0 0" }}>
            Consulta y exporta reportes de ventas, productos y caja
          </p>
        </div>
        <button onClick={handleExportar} disabled={exportando} style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "9px 16px", borderRadius: 8,
          border: `1px solid rgba(44,85,69,0.25)`,
          background: "white", color: COLOR.verde,
          fontFamily: "'Lato',sans-serif", fontSize: 13, fontWeight: 600,
          cursor: exportando ? "not-allowed" : "pointer",
          opacity: exportando ? 0.7 : 1,
        }}>
          <Download size={14} />
          {exportando ? "Generando..." : "Exportar Excel"}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8 }}>
        {TABS.map(({ id, label, Icon }) => (
          <TabBtn key={id} activo={tab === id} onClick={() => cambiarTab(id)} Icon={Icon}>
            {label}
          </TabBtn>
        ))}
      </div>

      {/* Filtro período */}
      <div style={{ background: "white", border: `1.5px solid ${COLOR.borde}`,
        borderRadius: 12, padding: "16px 20px" }}>
        <SeccionLabel>Período</SeccionLabel>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label style={estilos.inputLabel}>Desde</label>
            <input type="date" value={fechaInicio}
              onChange={e => setFechaInicio(e.target.value)} style={estilos.input} />
          </div>
          <div>
            <label style={estilos.inputLabel}>Hasta</label>
            <input type="date" value={fechaFin}
              onChange={e => setFechaFin(e.target.value)} style={estilos.input} />
          </div>
          <button onClick={handleConsultar} disabled={cargando} style={{
            ...estilos.btn,
            background: cargando ? "#aaa" : COLOR.verde,
            cursor: cargando ? "not-allowed" : "pointer",
          }}>
            <TrendingUp size={14} />
            {cargando ? "Consultando..." : "Consultar"}
          </button>
        </div>
        {error && (
          <p style={{ fontFamily: "'Lato',sans-serif", fontSize: 12,
            color: COLOR.rojo, margin: "12px 0 0 0" }}>⚠ {error}</p>
        )}
      </div>

      {/* ── Tab Ventas ── */}
      {tab === "ventas" && dataVentas && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <StatCard label="Total ventas"
              value={`S/ ${parseFloat(String(dataVentas.total_ventas)).toFixed(2)}`}
              sub={`${dataVentas.total_ordenes} órdenes`} />
            <StatCard label="Ticket promedio"
              value={`S/ ${parseFloat(String(dataVentas.ticket_promedio)).toFixed(2)}`} />
          </div>

          <div>
            <SeccionLabel>Ventas por día</SeccionLabel>
            <Tabla
              headers={["Fecha", "Total (S/)", "Órdenes"]}
              rows={(dataVentas.ventas_por_dia ?? []).map(r => [
                r.fecha_dia,
                `S/ ${parseFloat(String(r.total)).toFixed(2)}`,
                r.ordenes,
              ])}
            />
          </div>

          <div>
            <SeccionLabel>Por método de pago</SeccionLabel>
            <Tabla
              headers={["Método", "Total (S/)", "Cantidad"]}
              rows={(dataVentas.ventas_por_metodo_pago ?? []).map(r => [
                r.metodo_pago,
                `S/ ${parseFloat(String(r.total)).toFixed(2)}`,
                r.cantidad,
              ])}
            />
          </div>
        </div>
      )}

      {/* ── Tab Productos ── */}
      {tab === "productos" && dataProductos && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <SeccionLabel>Productos más vendidos</SeccionLabel>
            <Tabla
              headers={["Producto", "Categoría", "Cantidad vendida", "Total (S/)"]}
              rows={(dataProductos.productos ?? []).map(r => [
                r.nombre,
                r.categoria ?? "—",
                r.cantidad,
                `S/ ${parseFloat(String(r.total)).toFixed(2)}`,
              ])}
            />
          </div>

          {(dataProductos.promociones ?? []).length > 0 && (
            <div>
              <SeccionLabel>Promociones más vendidas</SeccionLabel>
              <Tabla
                headers={["Promoción", "Cantidad", "Total (S/)"]}
                rows={(dataProductos.promociones ?? []).map(r => [
                  r.nombre,
                  r.cantidad,
                  `S/ ${parseFloat(String(r.total)).toFixed(2)}`,
                ])}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Tab Caja ── */}
      {tab === "caja" && dataCaja && (
        <div>
          <SeccionLabel>Turnos de caja</SeccionLabel>
          <Tabla
            headers={["Caja #", "Cajero", "Estado", "Apertura", "Total ventas (S/)", "Diferencia (S/)"]}
            rows={(dataCaja.turnos ?? []).map(r => [
              `#${r.caja_id}`,
              r.cajero,
              r.estado,
              r.fecha_apertura
                ? new Date(r.fecha_apertura).toLocaleString("es-PE")
                : "—",
              `S/ ${parseFloat(String(r.total_ventas)).toFixed(2)}`,
              r.diferencia !== null
                ? (
                  <span style={{
                    color: Number(r.diferencia) >= 0 ? "#2e7d32" : COLOR.rojo,
                    fontWeight: 600,
                  }}>
                    {Number(r.diferencia) >= 0 ? "+" : ""}S/ {parseFloat(String(r.diferencia)).toFixed(2)}
                  </span>
                )
                : "—",
            ])}
          />
        </div>
      )}

      {/* Estado vacío inicial */}
      {!cargando && !dataVentas && !dataProductos && !dataCaja && !error && (
        <div style={{ textAlign: "center", padding: "60px 0",
          color: "rgba(44,85,69,0.45)", fontFamily: "'Lato',sans-serif", fontSize: 14 }}>
          Selecciona un período y presiona <strong>Consultar</strong> para ver el reporte.
        </div>
      )}
    </div>
  );
}

const estilos = {
  inputLabel: {
    fontFamily: "'Lato',sans-serif", fontSize: 11, fontWeight: 700,
    color: "rgba(44,85,69,0.75)", textTransform: "uppercase",
    letterSpacing: "0.07em", display: "block", marginBottom: 5,
  },
  input: {
    padding: "9px 12px", borderRadius: 8,
    border: "1px solid rgba(44,85,69,0.2)",
    fontFamily: "'Lato',sans-serif", fontSize: 13, color: "#333", outline: "none",
  },
  btn: {
    display: "flex", alignItems: "center", gap: 6,
    padding: "10px 16px", borderRadius: 8, border: "none",
    color: "white", fontFamily: "'Lato',sans-serif",
    fontSize: 13, fontWeight: 600,
  },
  th: {
    padding: "10px 16px", textAlign: "left",
    fontFamily: "'Lato',sans-serif", fontSize: 11, fontWeight: 700,
    color: "rgba(44,85,69,0.6)", textTransform: "uppercase", letterSpacing: "0.07em",
  },
  td: {
    padding: "10px 16px", fontFamily: "'Lato',sans-serif",
    fontSize: 13, color: "#444",
  },
} satisfies Record<string, CSSProperties>;
