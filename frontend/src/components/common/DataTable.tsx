import type { ReactNode } from "react";
import type { Columna } from "../../types";
import { LoadingSpinner, EmptyState } from "./LoadingSpinner-EmptyState";

interface DataTableProps<T extends { id?: number | string }> {
  columnas: Columna<T>[];
  datos: T[];
  total?: number;
  pagina?: number;
  onPagina?: (pagina: number) => void;
  porPagina?: number;
  cargando?: boolean;
  textoVacio?: string;
}

export default function DataTable<T extends { id?: number | string }>({
  columnas = [],
  datos = [],
  total = 0,
  pagina = 1,
  onPagina,
  porPagina = 10,
  cargando = false,
  textoVacio = "Sin registros",
}: DataTableProps<T>) {
  const totalPaginas = Math.ceil(total / porPagina);

  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "12px",
        border: "1px solid rgba(44,85,69,0.1)",
        boxShadow: "0 2px 12px rgba(44,85,69,0.06)",
        overflow: "hidden",
      }}
    >
      {/* Tabla */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          {/* Encabezado */}
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(44,85,69,0.1)" }}>
              {columnas.map((col, i) => (
                <th
                  key={i}
                  style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontFamily: "'Lato', sans-serif",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: "rgba(44,85,69,0.7)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    backgroundColor: "rgba(44,85,69,0.03)",
                    whiteSpace: "nowrap",
                    width: col.width ?? "auto",
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={columnas.length} style={{ padding: 0 }}>
                  <LoadingSpinner texto="Cargando datos..." />
                </td>
              </tr>
            ) : datos.length === 0 ? (
              <tr>
                <td colSpan={columnas.length} style={{ padding: 0 }}>
                  <EmptyState titulo={textoVacio} />
                </td>
              </tr>
            ) : (
              datos.map((fila, rowIdx) => (
                <tr
                  key={fila.id ?? rowIdx}
                  style={{
                    borderBottom: "1px solid rgba(44,85,69,0.06)",
                    transition: "background-color 0.15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(44,85,69,0.025)"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  {columnas.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      style={{
                        padding: "12px 16px",
                        fontFamily: "'Lato', sans-serif",
                        fontSize: "13.5px",
                        color: "#333",
                        verticalAlign: "middle",
                      }}
                    >
                      {col.render ? col.render(fila) : String((col.key ? (fila as Record<string, unknown>)[col.key] : undefined) ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {!cargando && totalPaginas > 1 && (
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderTop: "1px solid rgba(44,85,69,0.08)" }}
        >
          <p
            style={{
              fontFamily: "'Lato', sans-serif",
              fontSize: "12px",
              color: "rgba(44,85,69,0.6)",
              margin: 0,
            }}
          >
            {total} registro{total !== 1 ? "s" : ""} — página {pagina} de {totalPaginas}
          </p>

          <div className="flex items-center gap-1">
            {/* Anterior */}
            <PagBtn
              onClick={() => onPagina?.(pagina - 1)}
              disabled={pagina === 1}
            >
              ‹
            </PagBtn>

            {/* Números de página */}
            {getPaginas(pagina, totalPaginas).map((p, i) =>
              p === "…" ? (
                <span
                  key={i}
                  style={{
                    padding: "0 6px",
                    fontFamily: "'Lato', sans-serif",
                    fontSize: "13px",
                    color: "rgba(44,85,69,0.4)",
                  }}
                >
                  …
                </span>
              ) : (
                <PagBtn
                  key={i}
                  onClick={() => onPagina?.(p)}
                  activo={p === pagina}
                >
                  {p}
                </PagBtn>
              )
            )}

            {/* Siguiente */}
            <PagBtn
              onClick={() => onPagina?.(pagina + 1)}
              disabled={pagina === totalPaginas}
            >
              ›
            </PagBtn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Botón de paginación ──────────────────────────────────────────────────────
interface PagBtnProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  activo?: boolean;
}

function PagBtn({ children, onClick, disabled, activo }: PagBtnProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 30,
        height: 30,
        padding: "0 6px",
        borderRadius: "6px",
        border: activo ? "1px solid #2C5545" : "1px solid transparent",
        backgroundColor: activo ? "#2C5545" : "transparent",
        color: activo ? "white" : disabled ? "rgba(44,85,69,0.25)" : "#2C5545",
        fontFamily: "'Lato', sans-serif",
        fontSize: "13px",
        fontWeight: activo ? 600 : 400,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ─── Genera array de páginas con elipsis ─────────────────────────────────────
function getPaginas(actual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (actual <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (actual >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", actual - 1, actual, actual + 1, "…", total];
}
