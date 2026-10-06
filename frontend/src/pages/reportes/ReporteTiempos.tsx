import { ArrowRight, Timer } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "../../components/common";
import type { ReporteTiempos as Datos } from "../../types";

/** 45 → "45 s" · 720 → "12 min" · 3900 → "1 h 05 min" */
function duracion(seg: number | null): string {
  if (seg === null) return "—";
  if (seg < 60) return `${seg} s`;
  const min = Math.round(seg / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

const minutos = (seg: number) => Math.round((seg / 60) * 10) / 10;
const rangoHora = (h: number) => `${String(h).padStart(2, "0")}:00 – ${String((h + 1) % 24).padStart(2, "0")}:00`;
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-PE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * Reporte de tiempos: cuánto tarda un pedido en llegar a la mesa y en qué
 * etapa se va el tiempo (ver memos_cafe/reportes/tiempos.py). Usa la
 * mediana ("lo típico") y el percentil 90 ("9 de cada 10").
 */
export default function ReporteTiempos({ datos }: { datos: Datos }) {
  if (datos.total.n === 0 && datos.etapas.every((e) => e.n === 0)) {
    return (
      <EmptyState
        titulo="Todavía no hay rondas servidas en este período"
        subtitulo="El reporte se arma con las comandas que pasan por Cocina y se marcan como servidas."
        icono={<Timer strokeWidth={1.6} />}
      />
    );
  }

  const cocina = datos.etapas.filter((e) => e.clave !== "cobro");
  const cobro = datos.etapas.find((e) => e.clave === "cobro");
  const masLenta = cocina.reduce<(typeof cocina)[number] | null>(
    (peor, e) => (e.mediana !== null && (peor === null || e.mediana > (peor.mediana ?? 0)) ? e : peor),
    null
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Cifra principal */}
      <section className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-linea bg-marfil p-5 shadow-suave">
          <p className="text-sm font-medium text-suave">Del pedido a la mesa, lo típico</p>
          <p className="mt-1 font-display text-5xl font-semibold leading-none text-espresso tabular-nums">
            {duracion(datos.total.mediana)}
          </p>
          <p className="mt-3 text-sm text-suave">
            9 de cada 10 rondas llegan en menos de <b className="text-espresso">{duracion(datos.total.p90)}</b> ·{" "}
            {datos.total.n} rondas servidas
          </p>
        </div>
        <Medidor pct={datos.total.a_tiempo_pct} objetivo={datos.objetivo_min} />
      </section>

      {/* Dónde se va el tiempo */}
      <section>
        <h3 className="mb-1 font-display text-xl font-semibold text-espresso">¿Dónde se va el tiempo?</h3>
        <p className="mb-3 text-sm text-suave">Lo típico de cada etapa de una ronda, en orden.</p>
        <ol className="grid gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {cocina.map((e, i) => (
            <li key={e.clave} className="contents">
              {i > 0 && (
                <span aria-hidden className="hidden place-items-center text-tenue md:grid">
                  <ArrowRight className="size-5" />
                </span>
              )}
              <Etapa etapa={e} destacada={masLenta?.clave === e.clave && cocina.filter((x) => x.mediana !== null).length > 1} />
            </li>
          ))}
        </ol>
        {cobro && cobro.n > 0 && (
          <p className="mt-3 rounded-2xl border border-linea bg-marfil px-4 py-3 text-sm text-espresso">
            <b>Cobro:</b> desde que la mesa pide la cuenta hasta que paga, lo típico es{" "}
            <b className="tabular-nums">{duracion(cobro.mediana)}</b> (9 de cada 10 en menos de {duracion(cobro.p90)}).
          </p>
        )}
      </section>

      {/* Por hora */}
      {datos.por_hora.length > 0 && <PorHora datos={datos} />}

      {/* Productos y meseros */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Tabla
          titulo="Lo que más tarda en prepararse"
          nota="Tiempo típico de las rondas que lo incluyen."
          columnas={["Producto", "Rondas", "Preparación"]}
          numericas={[1, 2]}
          filas={datos.por_producto.slice(0, 8).map((p) => [p.nombre, p.rondas, duracion(p.mediana_preparacion)])}
          vacio="Sin rondas preparadas en el período."
        />
        <Tabla
          titulo="Llevar a la mesa, por mesero"
          nota="Desde que Cocina la deja lista hasta que se sirve."
          columnas={["Mesero", "Rondas", "Típico"]}
          numericas={[1, 2]}
          filas={datos.por_mesero.map((m) => [m.nombre, m.rondas, duracion(m.mediana_servir)])}
          vacio="Sin rondas servidas en el período."
        />
      </section>

      {/* Demoras */}
      {datos.demoras.length > 0 && (
        <Tabla
          titulo="Las rondas más demoradas"
          nota={`Del pedido a la mesa; el objetivo es ${datos.objetivo_min} min.`}
          columnas={["Cuándo", "Para", "Total", "Se fue en"]}
          numericas={[2]}
          filas={datos.demoras.map((d) => [
            fechaHora(d.fecha),
            d.ronda > 1 ? `${d.destino} · ${d.ronda}.ª ronda` : d.destino,
            duracion(d.total),
            d.etapa_mas_larga ?? "—",
          ])}
          vacio=""
        />
      )}
    </div>
  );
}

function Medidor({ pct, objetivo }: { pct: number | null; objetivo: number }) {
  const valor = pct ?? 0;
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-linea bg-marfil p-5 shadow-suave">
      <div>
        <p className="text-sm font-medium text-suave">A tiempo (hasta {objetivo} min)</p>
        <p className="mt-1 font-display text-5xl font-semibold leading-none text-espresso tabular-nums">
          {pct === null ? "—" : `${pct}%`}
        </p>
      </div>
      <div
        className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-salvia-clara"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valor}
        aria-label={`${valor}% de las rondas llegan a tiempo`}
      >
        <div className="h-full rounded-full bg-salvia" style={{ width: `${valor}%` }} />
      </div>
    </div>
  );
}

function Etapa({ etapa: e, destacada }: { etapa: Datos["etapas"][number]; destacada: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${destacada ? "border-salvia bg-salvia-clara" : "border-linea bg-marfil"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-espresso">{e.nombre}</p>
        {destacada && (
          <span className="rounded-full bg-salvia px-2 py-0.5 text-[11px] font-bold text-marfil">MÁS TIEMPO</span>
        )}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold leading-none text-espresso tabular-nums">{duracion(e.mediana)}</p>
      <p className="mt-2 text-xs text-suave">
        {e.n > 0 ? `9 de 10 en menos de ${duracion(e.p90)}` : "Sin datos"} · {e.descripcion.toLowerCase()}
      </p>
    </div>
  );
}

function PorHora({ datos }: { datos: Datos }) {
  const filas = datos.por_hora.map((h) => ({ ...h, min: minutos(h.mediana), etiqueta: `${h.hora}h` }));
  const tope = Math.max(datos.objetivo_min, ...filas.map((f) => f.min));
  return (
    <section className="rounded-2xl border border-linea bg-marfil p-4 shadow-suave sm:p-5">
      <h3 className="font-display text-xl font-semibold text-espresso">Tiempo típico por hora del día</h3>
      <p className="mb-3 text-sm text-suave">Del pedido a la mesa, según la hora en que llegó a Cocina. La línea es el objetivo.</p>
      <div className="h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={filas} margin={{ top: 16, right: 8, bottom: 0, left: -16 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--linea)" />
            <XAxis dataKey="etiqueta" tickLine={false} axisLine={{ stroke: "var(--linea-fuerte)" }} tick={{ fill: "var(--suave)", fontSize: 12 }} />
            <YAxis
              domain={[0, Math.ceil(tope * 1.15)]}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--suave)", fontSize: 12 }}
              unit=" min"
              width={64}
            />
            <ReferenceLine
              y={datos.objetivo_min}
              stroke="var(--espresso)"
              strokeDasharray="4 4"
              label={{ value: `Objetivo ${datos.objetivo_min} min`, position: "insideTopRight", fill: "var(--espresso)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--arena)", opacity: 0.6 }}
              content={({ active, payload }) => {
                const f = active && payload?.[0]?.payload as (typeof filas)[number] | undefined;
                if (!f) return null;
                return (
                  <div className="rounded-xl border border-linea bg-marfil px-3 py-2 text-sm shadow-alta">
                    <p className="font-semibold text-espresso">{rangoHora(f.hora)}</p>
                    <p className="text-espresso">{duracion(f.mediana)} lo típico</p>
                    <p className="text-suave">{f.comandas} {f.comandas === 1 ? "ronda" : "rondas"}</p>
                  </div>
                );
              }}
            />
            <Bar dataKey="min" fill="var(--salvia)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Lo mismo en texto para lectores de pantalla */}
      <table className="sr-only">
        <caption>Tiempo típico por hora del día</caption>
        <thead><tr><th>Hora</th><th>Tiempo típico</th><th>Rondas</th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.hora}><td>{rangoHora(f.hora)}</td><td>{duracion(f.mediana)}</td><td>{f.comandas}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Tabla({
  titulo, nota, columnas, numericas, filas, vacio,
}: {
  titulo: string;
  nota: string;
  columnas: string[];
  /** Índices de las columnas con números: van alineadas a la derecha. */
  numericas: number[];
  filas: (string | number)[][];
  vacio: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-linea bg-marfil shadow-suave">
      <div className="px-4 pt-4 sm:px-5">
        <h3 className="font-display text-lg font-semibold text-espresso">{titulo}</h3>
        <p className="text-sm text-suave">{nota}</p>
      </div>
      {filas.length === 0 ? (
        <p className="px-5 py-6 text-sm text-tenue">{vacio}</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-linea text-left text-xs font-semibold uppercase tracking-wide text-suave">
                {columnas.map((c, i) => (
                  <th key={c} className={`px-4 py-2 sm:px-5 ${numericas.includes(i) ? "text-right" : ""}`}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f, n) => (
                <tr key={n} className="border-b border-linea/60 last:border-0">
                  {f.map((v, i) => (
                    <td key={i} className={`px-4 py-2.5 text-espresso sm:px-5 ${numericas.includes(i) ? "whitespace-nowrap text-right tabular-nums" : i === 0 ? "font-medium" : ""}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
