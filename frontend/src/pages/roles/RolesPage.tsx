import useRoles from "../../hooks/useRoles";
import { PageHeader, LoadingSpinner } from "../../components/common";

const ROLES_COLS = [
  { key: "admin",  label: "Admin" },
  { key: "cajero", label: "Cajero" },
  { key: "mesero", label: "Mesero" },
] as const;

const ROL_COLORES: Record<string, { bg: string; color: string }> = {
  admin:  { bg: "rgba(44,85,69,0.12)",  color: "#2C5545" },
  cajero: { bg: "rgba(201,168,76,0.15)", color: "#9a7a1a" },
  mesero: { bg: "rgba(33,150,243,0.12)", color: "#1565c0" },
};

export default function RolesPage() {
  const { porModulo, cargando, guardando, error, exito, setError, handleToggle } = useRoles();

  const filas = Object.values(porModulo);

  return (
    <>
      <PageHeader
        titulo="Gestión de Roles y Permisos"
        descripcion="Define qué puede hacer cada rol en el sistema"
      />

      {/* Mensajes */}
      {error && (
        <div
          onClick={() => setError(null)}
          style={{
            backgroundColor: "rgba(198,40,40,0.08)",
            border: "1px solid rgba(198,40,40,0.25)",
            borderRadius: "8px", padding: "10px 14px",
            marginBottom: 16, cursor: "pointer",
            fontFamily: "'Lato', sans-serif",
            fontSize: "13px", color: "#c62828",
          }}
        >
          ⚠ {error} — <span style={{ textDecoration: "underline" }}>Cerrar</span>
        </div>
      )}

      {exito && (
        <div style={{
          backgroundColor: "rgba(44,85,69,0.08)",
          border: "1px solid rgba(44,85,69,0.25)",
          borderRadius: "8px", padding: "10px 14px",
          marginBottom: 16,
          fontFamily: "'Lato', sans-serif",
          fontSize: "13px", color: "#2C5545",
        }}>
          ✓ Permiso actualizado correctamente
        </div>
      )}

      {cargando ? (
        <LoadingSpinner />
      ) : (
        <div style={{
          backgroundColor: "white",
          borderRadius: "12px",
          border: "1px solid rgba(44,85,69,0.12)",
          overflowX: "auto",
        }}>
          {/* Header tabla — minWidth evita que las columnas se aplasten en mobile; el
              contenedor scrollea horizontal en vez de romper el layout */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr repeat(3, 120px)",
            minWidth: 520,
            backgroundColor: "rgba(44,85,69,0.04)",
            borderBottom: "1px solid rgba(44,85,69,0.12)",
            padding: "12px 20px",
          }}>
            <span style={{
              fontFamily: "'Lato', sans-serif", fontSize: 11,
              fontWeight: 700, color: "rgba(44,85,69,0.6)",
              letterSpacing: "0.07em", textTransform: "uppercase",
            }}>
              Módulo
            </span>
            {ROLES_COLS.map(({ key, label }) => (
              <span key={key} style={{
                fontFamily: "'Lato', sans-serif", fontSize: 11,
                fontWeight: 700, letterSpacing: "0.07em",
                textTransform: "uppercase", textAlign: "center",
                color: ROL_COLORES[key].color,
              }}>
                {label}
              </span>
            ))}
          </div>

          {/* Filas */}
          {filas.map((fila, idx) => (
            <div
              key={fila.modulo}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr repeat(3, 120px)",
                minWidth: 520,
                padding: "14px 20px",
                alignItems: "center",
                borderBottom: idx < filas.length - 1 ? "1px solid rgba(44,85,69,0.08)" : "none",
                backgroundColor: idx % 2 === 0 ? "white" : "rgba(44,85,69,0.015)",
              }}
            >
              <span style={{
                fontFamily: "'Lato', sans-serif", fontSize: 13.5,
                fontWeight: 500, color: "#2C5545",
              }}>
                {fila.label}
              </span>

              {ROLES_COLS.map(({ key }) => {
                const permiso = fila.roles[key];
                if (!permiso) return <div key={key} />;
                return (
                  <div key={key} style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      onClick={() => handleToggle(permiso)}
                      disabled={guardando}
                      title={permiso.puede_acceder ? "Quitar acceso" : "Dar acceso"}
                      style={{
                        width: 36, height: 20,
                        borderRadius: "999px",
                        border: "none",
                        cursor: guardando ? "not-allowed" : "pointer",
                        backgroundColor: permiso.puede_acceder
                          ? ROL_COLORES[key].color
                          : "rgba(120,120,120,0.2)",
                        transition: "background-color 0.2s",
                        position: "relative",
                        opacity: guardando ? 0.6 : 1,
                      }}
                    >
                      <div style={{
                        width: 14, height: 14,
                        borderRadius: "50%",
                        backgroundColor: "white",
                        position: "absolute",
                        top: 3,
                        left: permiso.puede_acceder ? 19 : 3,
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
