import { useMemo, useState } from "react";
import { BellRing, Clock, LayoutGrid, List, QrCode, Receipt, Users } from "lucide-react";
import { useReloj } from "../../../hooks/useReloj";
import { Lienzo, Elemento } from "./Lienzo";
import { estiloPieza, letra } from "./geometria";
import FichaMesa from "./FichaMesa";
import { conPosicion, duracion, ETIQUETA, situacion, soles, URGENCIA, type Situacion } from "./estadoMesa";
import type { MesaPlano, Plano } from "../../../types";

const ESTILO: Record<Situacion, string> = {
  libre: "bg-marfil border-2 border-linea-fuerte text-espresso",
  reservada: "bg-aviso-fondo border-2 border-dashed border-aviso/60 text-aviso",
  ocupada: "bg-salvia text-marfil",
  demorada: "bg-salvia text-marfil ring-4 ring-peligro/70",
  lista: "bg-salvia text-marfil ring-4 ring-exito/60",
  cuenta: "bg-salvia text-marfil ring-4 ring-champan/60",
  por_confirmar: "bg-aviso-fondo border-2 border-aviso text-aviso animate-pulse",
};

const PUNTO: Record<Situacion, string> = {
  libre: "bg-marfil border-2 border-linea-fuerte",
  reservada: "bg-aviso-fondo border-2 border-dashed border-aviso",
  ocupada: "bg-salvia",
  demorada: "bg-salvia ring-2 ring-peligro",
  lista: "bg-exito",
  cuenta: "bg-champan",
  por_confirmar: "bg-aviso",
};

export default function SalonVista({ plano, onCambio }: { plano: Plano; onCambio: () => void }) {
  const ahora = useReloj().getTime();
  const [modo, setModo] = useState<"plano" | "lista">("plano");
  const [abierta, setAbierta] = useState<number | null>(null);
  const mesas = useMemo(() => conPosicion(plano.mesas, plano.ancho, plano.alto), [plano]);
  const mesaAbierta = mesas.find((m) => m.id === abierta) ?? null;

  const conteo = mesas.reduce(
    (acc, m) => {
      const s = situacion(m, ahora);
      if (s === "libre") acc.libres += 1;
      else if (s !== "reservada") acc.ocupadas += 1;
      if (s === "por_confirmar" || s === "lista" || s === "cuenta" || s === "demorada") acc.atender += 1;
      return acc;
    },
    { libres: 0, ocupadas: 0, atender: 0 }
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-suave">
          <b className="text-espresso">{conteo.ocupadas}</b> ocupadas · <b className="text-espresso">{conteo.libres}</b> libres
          {conteo.atender > 0 && (
            <> · <b className="text-peligro">{conteo.atender} por atender</b></>
          )}
        </p>
        <div className="flex rounded-xl bg-arena p-1 md:hidden" role="tablist" aria-label="Vista">
          {([["plano", LayoutGrid, "Plano"], ["lista", List, "Lista"]] as const).map(([v, Icono, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={modo === v}
              onClick={() => setModo(v)}
              className={`flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ${modo === v ? "bg-marfil text-espresso shadow-suave" : "text-suave"}`}
            >
              <Icono className="size-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className={modo === "lista" ? "hidden md:block" : ""}>
        <Lienzo ancho={plano.ancho} alto={plano.alto}>
          {plano.elementos.map((el) => (
            <Elemento key={el.id ?? `${el.tipo}-${el.plano_x}-${el.plano_y}`} el={el} ancho={plano.ancho} alto={plano.alto} />
          ))}
          {mesas.map((m) => (
            <MesaEnPlano key={m.id} mesa={m} plano={plano} ahora={ahora} onAbrir={() => setAbierta(m.id)} />
          ))}
        </Lienzo>
      </div>

      {modo === "lista" && (
        <ul className="flex flex-col gap-2 md:hidden">
          {[...mesas]
            .sort((a, b) => URGENCIA[situacion(a, ahora)] - URGENCIA[situacion(b, ahora)] || a.numero - b.numero)
            .map((m) => (
              <li key={m.id}><MesaEnLista mesa={m} ahora={ahora} onAbrir={() => setAbierta(m.id)} /></li>
            ))}
        </ul>
      )}

      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-suave" aria-label="Leyenda">
        {(["libre", "ocupada", "por_confirmar", "lista", "cuenta", "demorada", "reservada"] as Situacion[]).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={`size-3 rounded-full ${PUNTO[s]}`} aria-hidden />
            {ETIQUETA[s]}
          </li>
        ))}
      </ul>

      {mesaAbierta && <FichaMesa mesa={mesaAbierta} onCerrar={() => setAbierta(null)} onCambio={onCambio} />}
    </div>
  );
}

function Insignia({ s }: { s: Situacion }) {
  const conf = {
    por_confirmar: { Icono: QrCode, clase: "bg-aviso text-marfil" },
    lista: { Icono: BellRing, clase: "bg-exito text-marfil animate-bounce" },
    cuenta: { Icono: Receipt, clase: "bg-champan text-marfil" },
    demorada: { Icono: Clock, clase: "bg-peligro text-marfil" },
  }[s as "por_confirmar" | "lista" | "cuenta" | "demorada"];
  if (!conf) return null;
  const { Icono, clase } = conf;
  return (
    <span
      className={`absolute -right-[12%] -top-[12%] grid place-items-center rounded-full shadow-suave ring-2 ring-marfil ${clase}`}
      style={{ width: letra(34, 18), height: letra(34, 18) }}
      aria-hidden
    >
      <Icono style={{ width: "55%", height: "55%" }} />
    </span>
  );
}

function MesaEnPlano({ mesa: m, plano, ahora, onAbrir }: { mesa: MesaPlano; plano: Plano; ahora: number; onAbrir: () => void }) {
  const s = situacion(m, ahora);
  const sala = m.sala;
  const conOrden = !!sala?.orden_id;
  // El contenido no gira con la mesa: solo la forma.
  const estilo = { ...estiloPieza({ ...m, rotacion: 0 }, plano.ancho, plano.alto) };
  return (
    <button
      type="button"
      onClick={onAbrir}
      style={estilo}
      aria-label={`Mesa ${m.numero}, ${ETIQUETA[s]}${conOrden ? `, ${soles(sala!.total)}` : ""}`}
      className="group"
    >
      <span
        className={`absolute inset-0 shadow-suave transition-transform group-active:scale-95 ${m.forma === "redonda" ? "rounded-full" : "rounded-[22%]"} ${ESTILO[s]}`}
        style={{ transform: m.rotacion ? `rotate(${m.rotacion}deg)` : undefined }}
      />
      <span className="relative flex h-full flex-col items-center justify-center leading-none">
        <span className="font-display font-semibold" style={{ fontSize: letra(conOrden ? 24 : 28, 15) }}>{m.numero}</span>
        {/* En pantallas angostas la mesa es chica: solo el número (el
            detalle está en la vista Lista y en la ficha). */}
        {conOrden ? (
          <span className="hidden flex-col items-center @2xl:flex">
            <span className="mt-[6%] font-semibold tabular-nums" style={{ fontSize: letra(12, 9) }}>{soles(sala!.total)}</span>
            <span className="mt-[3%] opacity-85 tabular-nums" style={{ fontSize: letra(11, 8) }}>{duracion(sala!.abierta_en, ahora)}</span>
          </span>
        ) : (
          <span className="mt-[6%] hidden items-center gap-[0.3em] opacity-70 @2xl:flex" style={{ fontSize: letra(11, 8) }}>
            <Users style={{ width: "1em", height: "1em" }} />{m.capacidad}
          </span>
        )}
      </span>
      <Insignia s={s} />
    </button>
  );
}

function MesaEnLista({ mesa: m, ahora, onAbrir }: { mesa: MesaPlano; ahora: number; onAbrir: () => void }) {
  const s = situacion(m, ahora);
  const sala = m.sala;
  return (
    <button type="button" onClick={onAbrir} className="flex w-full items-center gap-3 rounded-2xl border border-linea bg-marfil p-3 text-left shadow-suave active:bg-arena">
      <span className={`grid size-12 shrink-0 place-items-center font-display text-lg font-semibold ${m.forma === "redonda" ? "rounded-full" : "rounded-xl"} ${ESTILO[s]} !animate-none`}>
        {m.numero}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-espresso">{ETIQUETA[s]}</span>
        <span className="block truncate text-sm text-suave">
          {sala?.orden_id
            ? `${soles(sala.total)} · ${duracion(sala.abierta_en, ahora)}${sala.mesero ? ` · ${sala.mesero}` : ""}`
            : `${m.capacidad} personas`}
        </span>
      </span>
      <span className={`size-3 shrink-0 rounded-full ${PUNTO[s]}`} aria-hidden />
    </button>
  );
}
