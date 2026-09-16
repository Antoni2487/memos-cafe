import type { ReactNode } from "react";

interface PageHeaderProps {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
}

export default function PageHeader({ titulo, descripcion, accion }: PageHeaderProps) {
  return (
    <div
      className="flex items-start justify-between mb-6"
      style={{ borderBottom: "1px solid rgba(44,85,69,0.1)", paddingBottom: "16px" }}
    >
      <div>
        <h2
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "1.5rem",
            fontWeight: 600,
            color: "#2C5545",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {titulo}
        </h2>
        {descripcion && (
          <p
            style={{
              fontFamily: "'Lato', sans-serif",
              fontSize: "13px",
              color: "rgba(44,85,69,0.6)",
              margin: "4px 0 0 0",
            }}
          >
            {descripcion}
          </p>
        )}
      </div>

      {accion && <div className="shrink-0 ml-4">{accion}</div>}
    </div>
  );
}
