import { useState, type ChangeEvent, type ReactNode } from "react";

interface SearchBarProps {
  placeholder?: string;
  onBuscar?: (texto: string) => void;
  delay?: number;
  className?: string;
}

export function SearchBar({ placeholder = "Buscar...", onBuscar, delay = 400, className = "" }: SearchBarProps) {
  const [valor, setValor] = useState("");
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const texto = e.target.value;
    setValor(texto);
    if (timer) clearTimeout(timer);
    const nuevoTimer = setTimeout(() => onBuscar?.(texto), delay);
    setTimer(nuevoTimer);
  };

  const limpiar = () => {
    setValor("");
    if (timer) clearTimeout(timer);
    onBuscar?.("");
  };

  return (
    <div
      className={`flex items-center gap-2.5 ${className}`}
      style={{
        backgroundColor: "white",
        border: "1px solid rgba(44,85,69,0.18)",
        borderRadius: "8px",
        padding: "8px 12px",
        minWidth: "220px",
      }}
    >
      {/* Ícono lupa */}
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2C5545" strokeWidth="2" strokeLinecap="round" opacity={0.5}>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      <input
        type="text"
        value={valor}
        onChange={handleChange}
        placeholder={placeholder}
        style={{
          flex: 1,
          outline: "none",
          border: "none",
          background: "transparent",
          fontFamily: "'Lato', sans-serif",
          fontSize: "13.5px",
          color: "#333",
        }}
      />

      {/* Botón limpiar */}
      {valor && (
        <button
          onClick={limpiar}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#aaa", lineHeight: 1 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface StatCardProps {
  titulo: string;
  valor?: ReactNode;
  subtitulo?: string;
  icono?: ReactNode;
  tendencia?: "up" | "down";
  color?: string;
}

export function StatCard({ titulo, valor, subtitulo, icono, tendencia }: StatCardProps) {
  const tendenciaColor = tendencia === "up" ? "#2e7d32" : tendencia === "down" ? "#c62828" : "transparent";

  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "12px",
        padding: "20px",
        border: "1px solid rgba(201,168,76,0.2)",
        boxShadow: "0 2px 12px rgba(44,85,69,0.06)",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <p
          style={{
            fontFamily: "'Lato', sans-serif",
            fontSize: "11px",
            fontWeight: 700,
            color: "rgba(44,85,69,0.6)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            margin: 0,
          }}
        >
          {titulo}
        </p>
        {icono && (
          <div
            style={{
              width: 36, height: 36, borderRadius: "8px",
              backgroundColor: "rgba(44,85,69,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#2C5545",
            }}
          >
            {icono}
          </div>
        )}
      </div>

      <p
        style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: "26px",
          fontWeight: 600,
          color: "#2C5545",
          margin: "0 0 6px 0",
          lineHeight: 1,
        }}
      >
        {valor ?? "—"}
      </p>

      {subtitulo && (
        <div className="flex items-center gap-1.5">
          {tendencia && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={tendenciaColor} strokeWidth="2.5" strokeLinecap="round">
              {tendencia === "up"
                ? <path d="M18 15l-6-6-6 6" />
                : <path d="M6 9l6 6 6-6" />}
            </svg>
          )}
          <p
            style={{
              fontFamily: "'Lato', sans-serif",
              fontSize: "12px",
              color: tendencia ? tendenciaColor : "rgba(44,85,69,0.55)",
              margin: 0,
            }}
          >
            {subtitulo}
          </p>
        </div>
      )}
    </div>
  );
}
