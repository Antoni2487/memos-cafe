import { ChefHat, ShoppingBag, Truck } from "lucide-react";
import useCocina from "../../hooks/useCocina";
import { useReloj } from "../../hooks/useReloj";
import { PageHeader, StatusBadge, EmptyState, LoadingSpinner } from "../../components/common";
import type { DetalleCocina, EstadoPreparacion, TicketCocina } from "../../types";

const SIGUIENTE_ESTADO: Partial<Record<EstadoPreparacion, EstadoPreparacion>> = {
  pendiente: "en_preparacion",
  en_preparacion: "listo",
  listo: "entregado",
};

const TEXTO_ACCION: Record<EstadoPreparacion, string> = {
  pendiente: "Empezar",
  en_preparacion: "Marcar listo",
  listo: "Entregar",
  entregado: "",
};

const TIPO_ICONO = { mesa: ChefHat, llevar: ShoppingBag, delivery: Truck } as const;

function tiempoTranscurrido(fechaIso: string, ahora: Date): string {
  const minutos = Math.max(0, Math.floor((ahora.getTime() - new Date(fechaIso).getTime()) / 60000));
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `hace ${horas}h ${minutos % 60}min`;
}

function agruparPorRonda(detalles: DetalleCocina[]): [number, DetalleCocina[]][] {
  const grupos = new Map<number, DetalleCocina[]>();
  for (const d of detalles) {
    const grupo = grupos.get(d.ronda) ?? [];
    grupo.push(d);
    grupos.set(d.ronda, grupo);
  }
  return [...grupos.entries()].sort(([a], [b]) => a - b);
}

interface TicketCardProps {
  ticket: TicketCocina;
  ahora: Date;
  onAvanzar: (detalleId: number, estado: EstadoPreparacion) => void;
}

function TicketCard({ ticket, ahora, onAvanzar }: TicketCardProps) {
  const masAntiguo = ticket.detalles.reduce(
    (min, d) => (d.fecha_creacion < min ? d.fecha_creacion : min),
    ticket.detalles[0]?.fecha_creacion ?? ticket.fecha_creacion
  );
  const Icono = TIPO_ICONO[ticket.tipo_orden] ?? ChefHat;
  const rondas = agruparPorRonda(ticket.detalles);

  return (
    <div className="bg-white rounded-2xl shadow-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-brand">
        <div className="flex items-center gap-2 text-white font-body">
          <Icono size={18} strokeWidth={2} />
          <span className="font-display text-base font-semibold">
            {ticket.mesa_numero != null ? `Mesa ${ticket.mesa_numero}` : ticket.tipo_orden_display}
          </span>
        </div>
        <span className="text-white/80 text-xs font-body">{tiempoTranscurrido(masAntiguo, ahora)}</span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {rondas.map(([ronda, items]) => (
          <div key={ronda} className="flex flex-col gap-2">
            {rondas.length > 1 && (
              <span className="text-[11px] font-body font-semibold uppercase tracking-wide text-brand/60">
                Ronda {ronda}
              </span>
            )}
            {items.map((item) => {
              const siguiente = SIGUIENTE_ESTADO[item.estado_preparacion];
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-brand/10 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-body text-sm font-semibold text-brand truncate">
                      {item.cantidad}x {item.nombre}
                    </p>
                    {item.nota && (
                      <p className="font-body text-xs text-brand/60 truncate">{item.nota}</p>
                    )}
                    <div className="mt-1">
                      <StatusBadge estado={item.estado_preparacion} size="sm" />
                    </div>
                  </div>
                  {siguiente && (
                    <button
                      onClick={() => onAvanzar(item.id, siguiente)}
                      className="shrink-0 rounded-lg bg-brand px-3 py-2.5 font-body text-xs font-semibold text-white transition-colors hover:bg-brand-dark active:scale-95"
                    >
                      {TEXTO_ACCION[item.estado_preparacion]}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

const ESTADO_CONEXION: Record<string, { color: string; label: string }> = {
  conectado: { color: "#2e7d32", label: "En vivo" },
  conectando: { color: "#f57f17", label: "Conectando…" },
  reconectando: { color: "#c62828", label: "Reconectando…" },
};

export default function CocinaPage() {
  const { tickets, cargando, error, status, avanzarEstado } = useCocina();
  const ahora = useReloj();
  const conexion = ESTADO_CONEXION[status];

  return (
    <>
      <PageHeader
        titulo="Cocina"
        descripcion="Pedidos por preparar, en vivo"
        accion={
          <div className="flex items-center gap-2 font-body text-xs" style={{ color: "#2C5545" }}>
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: conexion.color }}
            />
            {conexion.label}
          </div>
        }
      />

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-2.5 font-body text-sm text-red-700">
          {error}
        </div>
      )}

      {cargando ? (
        <LoadingSpinner texto="Cargando tablero..." />
      ) : tickets.length === 0 ? (
        <EmptyState
          titulo="No hay pedidos pendientes"
          subtitulo="Los pedidos nuevos van a aparecer acá apenas lleguen."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              ahora={ahora}
              onAvanzar={(detalleId, estado) => avanzarEstado(ticket.id, detalleId, estado)}
            />
          ))}
        </div>
      )}
    </>
  );
}
