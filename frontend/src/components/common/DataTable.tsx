import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Columna } from "../../types";
import { useIsMobile } from "../../hooks/useMediaQuery";
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

function celda<T>(col: Columna<T>, fila: T): ReactNode {
  if (col.render) return col.render(fila);
  const valor = col.key ? (fila as Record<string, unknown>)[col.key] : undefined;
  return String(valor ?? "—");
}

const esAcciones = (label: string) => label.trim() === "" || label.toLowerCase() === "acciones";

/**
 * Tabla en tablet y computadora. En el celular cada fila se vuelve una
 * tarjeta: la primera columna es el título, las demás van como "dato: valor"
 * y las acciones quedan abajo, a la mano.
 */
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
  const esMovil = useIsMobile();
  const totalPaginas = Math.ceil(total / porPagina);

  const contenido = cargando ? (
    <LoadingSpinner texto="Cargando datos…" />
  ) : datos.length === 0 ? (
    <EmptyState titulo={textoVacio} />
  ) : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-linea bg-marfil shadow-suave">
      {esMovil ? (
        contenido ?? <Tarjetas columnas={columnas} datos={datos} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-linea bg-beige/60">
                {columnas.map((col, i) => (
                  <th
                    key={i}
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-suave"
                    style={{ width: col.width ?? "auto" }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contenido ? (
                <tr>
                  <td colSpan={columnas.length} className="p-0">{contenido}</td>
                </tr>
              ) : (
                datos.map((fila, rowIdx) => (
                  <tr key={fila.id ?? rowIdx} className="border-b border-linea/70 last:border-b-0 transition-colors hover:bg-beige/50">
                    {columnas.map((col, colIdx) => (
                      <td key={colIdx} className="px-4 py-3 align-middle text-espresso">
                        {celda(col, fila)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {!cargando && totalPaginas > 1 && (
        <div className="flex items-center justify-between gap-3 border-t border-linea px-4 py-3">
          <p className="text-xs text-suave">
            <span className="hidden sm:inline">{total} registro{total !== 1 ? "s" : ""} · </span>
            Página {pagina} de {totalPaginas}
          </p>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => onPagina?.(pagina - 1)} disabled={pagina === 1} etiqueta="Página anterior">
              <ChevronLeft className="size-4" />
            </PagBtn>
            {!esMovil &&
              getPaginas(pagina, totalPaginas).map((p, i) =>
                p === "…" ? (
                  <span key={i} className="px-1.5 text-sm text-suave">…</span>
                ) : (
                  <PagBtn key={i} onClick={() => onPagina?.(p)} activo={p === pagina} etiqueta={`Página ${p}`}>
                    {p}
                  </PagBtn>
                )
              )}
            <PagBtn onClick={() => onPagina?.(pagina + 1)} disabled={pagina === totalPaginas} etiqueta="Página siguiente">
              <ChevronRight className="size-4" />
            </PagBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function Tarjetas<T extends { id?: number | string }>({ columnas, datos }: { columnas: Columna<T>[]; datos: T[] }) {
  const [principal, ...resto] = columnas;
  const acciones = resto.filter((c) => esAcciones(c.label));
  const datosCol = resto.filter((c) => !esAcciones(c.label));

  return (
    <ul className="divide-y divide-linea">
      {datos.map((fila, i) => (
        <li key={fila.id ?? i} className="flex flex-col gap-2.5 px-4 py-3.5">
          {principal && <div className="font-medium text-espresso">{celda(principal, fila)}</div>}
          {datosCol.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
              {datosCol.map((col, j) => (
                <div key={j} className="contents">
                  <dt className="text-suave">{col.label}</dt>
                  <dd className="min-w-0 text-right text-espresso">{celda(col, fila)}</dd>
                </div>
              ))}
            </dl>
          )}
          {acciones.map((col, j) => (
            <div key={j} className="flex justify-end">{celda(col, fila)}</div>
          ))}
        </li>
      ))}
    </ul>
  );
}

interface PagBtnProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  activo?: boolean;
  etiqueta: string;
}

function PagBtn({ children, onClick, disabled, activo, etiqueta }: PagBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      aria-current={activo ? "page" : undefined}
      className={`grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        activo ? "bg-salvia font-semibold text-marfil" : "text-espresso hover:bg-arena"
      }`}
    >
      {children}
    </button>
  );
}

function getPaginas(actual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (actual <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (actual >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", actual - 1, actual, actual + 1, "…", total];
}
