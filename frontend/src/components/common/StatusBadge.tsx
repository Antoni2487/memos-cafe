interface EstiloEstado {
  bg: string;
  color: string;
  border: string;
}

const COLORES: Record<string, EstiloEstado> = {
  // Órdenes
  abierta:   { bg: "#e8f5e9", color: "#2e7d32", border: "rgba(46,125,50,0.25)" },
  cerrada:   { bg: "#f5f5f5", color: "#616161", border: "rgba(97,97,97,0.25)" },
  anulada:   { bg: "#fdecea", color: "#c62828", border: "rgba(198,40,40,0.25)" },
  // Mesas
  libre:     { bg: "#e8f5e9", color: "#2e7d32", border: "rgba(46,125,50,0.25)" },
  ocupada:   { bg: "#fdecea", color: "#c62828", border: "rgba(198,40,40,0.25)" },
  reservada: { bg: "#fff8e1", color: "#f57f17", border: "rgba(245,127,23,0.25)" },
  // Insumos
  ok:        { bg: "#e8f5e9", color: "#2e7d32", border: "rgba(46,125,50,0.25)" },
  bajo:      { bg: "#fff8e1", color: "#f57f17", border: "rgba(245,127,23,0.25)" },
  agotado:   { bg: "#fdecea", color: "#c62828", border: "rgba(198,40,40,0.25)" },
  // General
  activo:    { bg: "#e8f5e9", color: "#2e7d32", border: "rgba(46,125,50,0.25)" },
  inactivo:  { bg: "#f5f5f5", color: "#616161", border: "rgba(97,97,97,0.25)" },
  pendiente: { bg: "#fff8e1", color: "#f57f17", border: "rgba(245,127,23,0.25)" },
};

const LABELS: Record<string, string> = {
  abierta: "Abierta", cerrada: "Cerrada", anulada: "Anulada",
  libre: "Libre", ocupada: "Ocupada", reservada: "Reservada",
  ok: "OK", bajo: "Stock bajo", agotado: "Agotado",
  activo: "Activo", inactivo: "Inactivo", pendiente: "Pendiente",
};

interface StatusBadgeProps {
  estado?: string | null;
  size?: "sm" | "md";
}

export default function StatusBadge({ estado, size = "md" }: StatusBadgeProps) {
  const key = estado?.toLowerCase() ?? "";
  const estilo = COLORES[key] ?? { bg: "#f5f5f5", color: "#616161", border: "rgba(97,97,97,0.25)" };
  const label  = LABELS[key] ?? (estado ? estado.charAt(0).toUpperCase() + estado.slice(1) : "—");

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        backgroundColor: estilo.bg,
        color: estilo.color,
        border: `1px solid ${estilo.border}`,
        borderRadius: "999px",
        fontFamily: "'Lato', sans-serif",
        fontSize: size === "sm" ? "10px" : "11.5px",
        fontWeight: 600,
        padding: size === "sm" ? "2px 8px" : "3px 10px",
        letterSpacing: "0.03em",
        whiteSpace: "nowrap",
      }}
    >
      {/* Punto indicador */}
      <span
        style={{
          width: size === "sm" ? 5 : 6,
          height: size === "sm" ? 5 : 6,
          borderRadius: "50%",
          backgroundColor: estilo.color,
          display: "inline-block",
          marginRight: 5,
          flexShrink: 0,
        }}
      />
      {label}
    </span>
  );
}
