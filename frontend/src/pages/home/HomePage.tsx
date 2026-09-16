import { RefreshCw, Table2, ClipboardList, Coffee } from "lucide-react";
import { PageHeader, LoadingSpinner, StatCard } from "../../components/common";
import useHome from "../../hooks/useHome";
import authService from "../../services/authService";

const ESTADO_COLORES: Record<string, { bg: string; color: string; label: string }> = {
  libre:     { bg: "rgba(44,85,69,0.1)",   color: "#2C5545",  label: "Libre" },
  ocupada:   { bg: "rgba(198,40,40,0.1)",  color: "#c62828",  label: "Ocupada" },
  reservada: { bg: "rgba(201,168,76,0.15)", color: "#9a7a1a", label: "Reservada" },
};

export default function HomePage() {
  const { mesas, mesasLibres, mesasOcupadas, ordenesAbiertas, totalMesas, cargando, error, cargar } = useHome();
  const user = authService.getUser();

  if (cargando) return <LoadingSpinner />;

  return (
    <>
      <PageHeader
        titulo={`Bienvenido, ${user.nombre || user.email}`}
        descripcion="Resumen del estado actual del café"
        accion={
          <button
            onClick={cargar}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              backgroundColor: "white", color: "#2C5545",
              border: "1px solid rgba(44,85,69,0.25)",
              borderRadius: "8px", padding: "8px 14px",
              fontFamily: "'Lato', sans-serif", fontSize: "13px",
              fontWeight: 600, cursor: "pointer",
            }}
          >
            <RefreshCw size={14} strokeWidth={2} />
            Actualizar
          </button>
        }
      />

      {error && (
        <div style={{
          backgroundColor: "rgba(198,40,40,0.08)",
          border: "1px solid rgba(198,40,40,0.25)",
          borderRadius: "8px", padding: "10px 14px",
          marginBottom: 16, fontFamily: "'Lato', sans-serif",
          fontSize: "13px", color: "#c62828",
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard
          titulo="Mesas Libres"
          valor={mesasLibres}
          icono={<Table2 size={20} strokeWidth={1.8} />}
        />
        <StatCard
          titulo="Mesas Ocupadas"
          valor={mesasOcupadas}
          icono={<Coffee size={20} strokeWidth={1.8} />}
        />
        <StatCard
          titulo="Órdenes Abiertas"
          valor={ordenesAbiertas}
          icono={<ClipboardList size={20} strokeWidth={1.8} />}
        />
      </div>

      {/* Grid de mesas */}
      <div style={{
        backgroundColor: "white", borderRadius: "12px",
        border: "1px solid rgba(44,85,69,0.12)",
        padding: "20px",
      }}>
        <p style={{
          fontFamily: "'Lato', sans-serif", fontSize: 13,
          fontWeight: 700, color: "rgba(44,85,69,0.6)",
          letterSpacing: "0.07em", textTransform: "uppercase",
          margin: "0 0 16px 0",
        }}>
          Estado de Mesas — {totalMesas} en total
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: 10 }}>
          {mesas.map((mesa) => {
            const c = ESTADO_COLORES[mesa.estado] ?? ESTADO_COLORES.libre;
            return (
              <div key={mesa.id} style={{
                backgroundColor: c.bg, border: `1px solid ${c.color}33`,
                borderRadius: "10px", padding: "12px 8px",
                textAlign: "center",
              }}>
                <p style={{ margin: 0, fontFamily: "'Lato', sans-serif", fontSize: 13, fontWeight: 700, color: c.color }}>
                  {mesa.numero ?? `#${mesa.id}`}
                </p>
                <p style={{ margin: "4px 0 0", fontFamily: "'Lato', sans-serif", fontSize: 10, color: c.color, opacity: 0.8, textTransform: "capitalize" }}>
                  {c.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
