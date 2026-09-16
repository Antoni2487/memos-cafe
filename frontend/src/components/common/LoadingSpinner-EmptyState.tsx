import type { ReactNode } from "react";

interface LoadingSpinnerProps {
  texto?: string;
  full?: boolean;
}

export function LoadingSpinner({ texto = "Cargando...", full = false }: LoadingSpinnerProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3"
      style={{ minHeight: full ? "60vh" : "160px" }}
    >
      {/* Spinner SVG */}
      <svg
        className="animate-spin"
        style={{ width: 32, height: 32, color: "#2C5545" }}
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          cx="12" cy="12" r="10"
          stroke="currentColor"
          strokeWidth="3"
          opacity={0.2}
        />
        <path
          d="M12 2a10 10 0 0 1 10 10"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <p
        style={{
          fontFamily: "'Lato', sans-serif",
          fontSize: "13px",
          color: "rgba(44,85,69,0.6)",
          margin: 0,
        }}
      >
        {texto}
      </p>
    </div>
  );
}

interface EmptyStateProps {
  titulo?: string;
  subtitulo?: string;
  accion?: ReactNode;
  icono?: ReactNode;
}

export function EmptyState({ titulo, subtitulo, accion, icono }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16 px-6 text-center"
    >
      {/* Ícono */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          backgroundColor: "rgba(44,85,69,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icono ?? (
          <svg
            width="28" height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2C5545"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.5}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        )}
      </div>

      <div>
        <p
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "15px",
            fontWeight: 500,
            color: "#2C5545",
            margin: "0 0 4px 0",
          }}
        >
          {titulo}
        </p>
        {subtitulo && (
          <p
            style={{
              fontFamily: "'Lato', sans-serif",
              fontSize: "13px",
              color: "rgba(44,85,69,0.55)",
              margin: 0,
            }}
          >
            {subtitulo}
          </p>
        )}
      </div>

      {accion && <div>{accion}</div>}
    </div>
  );
}
