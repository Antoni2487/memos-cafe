type Tono = "exito" | "aviso" | "peligro" | "info" | "neutro";

const TONOS: Record<Tono, string> = {
  exito: "bg-exito-fondo text-exito",
  aviso: "bg-aviso-fondo text-aviso",
  peligro: "bg-peligro-fondo text-peligro",
  info: "bg-info-fondo text-info",
  neutro: "bg-arena text-suave",
};

const ESTADOS: Record<string, { tono: Tono; label: string }> = {
  // Órdenes
  abierta: { tono: "exito", label: "Abierta" },
  cerrada: { tono: "neutro", label: "Cerrada" },
  anulada: { tono: "peligro", label: "Anulada" },
  // Mesas
  libre: { tono: "exito", label: "Libre" },
  ocupada: { tono: "peligro", label: "Ocupada" },
  reservada: { tono: "aviso", label: "Reservada" },
  // Insumos
  ok: { tono: "exito", label: "OK" },
  bajo: { tono: "aviso", label: "Stock bajo" },
  agotado: { tono: "peligro", label: "Agotado" },
  // General
  activo: { tono: "exito", label: "Activo" },
  inactivo: { tono: "neutro", label: "Inactivo" },
  pendiente: { tono: "aviso", label: "Pendiente" },
  // Preparación (Cocina)
  en_preparacion: { tono: "info", label: "En preparación" },
  listo: { tono: "exito", label: "Listo" },
  lista: { tono: "exito", label: "Lista" },
  entregado: { tono: "neutro", label: "Entregado" },
  entregada: { tono: "neutro", label: "Entregada" },
};

interface StatusBadgeProps {
  estado?: string | null;
  size?: "sm" | "md";
}

export default function StatusBadge({ estado, size = "md" }: StatusBadgeProps) {
  const key = estado?.toLowerCase() ?? "";
  const conocido = ESTADOS[key];
  const tono = conocido?.tono ?? "neutro";
  const label = conocido?.label ?? (estado ? estado.charAt(0).toUpperCase() + estado.slice(1).replace(/_/g, " ") : "—");

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${TONOS[tono]} ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      <span className={`rounded-full bg-current ${size === "sm" ? "size-1.5" : "size-1.5"}`} aria-hidden />
      {label}
    </span>
  );
}
