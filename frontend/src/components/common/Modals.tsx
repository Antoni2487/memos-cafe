import { useEffect, type ReactNode, type FormEvent, type MouseEvent } from "react";

// ─── Base del modal (shared) ──────────────────────────────────────────────────
interface ModalBaseProps {
  children: ReactNode;
  onClose?: () => void;
  maxWidth?: string;
}

function ModalBase({ children, onClose, maxWidth = "420px" }: ModalBaseProps) {
  // Cierra con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto"
      style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
      onClick={(e: MouseEvent<HTMLDivElement>) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "14px",
          width: "100%",
          maxWidth,
          maxHeight: "calc(100vh - 48px)",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

type Variante = "danger" | "warning" | "primary";

interface ConfirmDialogProps {
  abierto: boolean;
  titulo?: string;
  descripcion?: string;
  textoOk?: string;
  textoCancelar?: string;
  variante?: Variante;
  cargando?: boolean;
  onConfirmar?: () => void;
  onCancelar?: () => void;
}

export function ConfirmDialog({
  abierto,
  titulo,
  descripcion,
  textoOk = "Confirmar",
  textoCancelar = "Cancelar",
  variante = "danger",
  cargando = false,
  onConfirmar,
  onCancelar,
}: ConfirmDialogProps) {
  if (!abierto) return null;

  const colores: Record<Variante, { bg: string; hover: string; icon: string; iconColor: string }> = {
    danger: { bg: "#c62828", hover: "#b71c1c", icon: "#fdecea", iconColor: "#c62828" },
    warning: { bg: "#f57f17", hover: "#e65100", icon: "#fff8e1", iconColor: "#f57f17" },
    primary: { bg: "#2C5545", hover: "#1E4A37", icon: "rgba(44,85,69,0.1)", iconColor: "#2C5545" },
  };
  const c = colores[variante] ?? colores.danger;

  return (
    <ModalBase onClose={onCancelar} maxWidth="400px">
      <div className="p-6">
        {/* Ícono */}
        <div
          className="flex items-center justify-center mx-auto mb-4"
          style={{ width: 52, height: 52, borderRadius: "50%", backgroundColor: c.icon }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>

        {/* Texto */}
        <h3
          className="text-center"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "17px", fontWeight: 600, color: "#2C5545", margin: "0 0 8px 0" }}
        >
          {titulo}
        </h3>
        {descripcion && (
          <p
            className="text-center whitespace-pre-line"
            style={{
              fontFamily: "'Lato', sans-serif",
              fontSize: "13.5px",
              color: "#666",
              margin: "0 0 20px 0",
              lineHeight: 1.5,
            }}
          >
            {descripcion}
          </p>
        )}

        {/* Botones */}
        <div className="flex gap-3">
          <button
            onClick={onCancelar}
            disabled={cargando}
            style={{
              flex: 1, padding: "10px", borderRadius: "8px",
              border: "1px solid rgba(44,85,69,0.2)", backgroundColor: "white",
              fontFamily: "'Lato', sans-serif", fontSize: "13px", fontWeight: 600,
              color: "#555", cursor: cargando ? "not-allowed" : "pointer",
            }}
          >
            {textoCancelar}
          </button>
          <button
            onClick={onConfirmar}
            disabled={cargando}
            style={{
              flex: 1, padding: "10px", borderRadius: "8px",
              border: "none", backgroundColor: cargando ? "#aaa" : c.bg,
              fontFamily: "'Lato', sans-serif", fontSize: "13px", fontWeight: 600,
              color: "white", cursor: cargando ? "not-allowed" : "pointer",
            }}
          >
            {cargando ? "Procesando..." : textoOk}
          </button>
        </div>
      </div>
    </ModalBase>
  );
}

interface FormModalProps {
  abierto: boolean;
  titulo?: string;
  onCerrar?: () => void;
  onGuardar?: () => void;
  cargando?: boolean;
  textoGuardar?: string;
  maxWidth?: string;
  children: ReactNode;
}

export function FormModal({
  abierto,
  titulo,
  onCerrar,
  onGuardar,
  cargando = false,
  textoGuardar = "Guardar",
  maxWidth = "480px",
  children,
}: FormModalProps) {
  if (!abierto) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onGuardar?.();
  };

  return (
    <ModalBase onClose={onCerrar} maxWidth={maxWidth}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid rgba(44,85,69,0.1)" }}
      >
        <h3
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "17px", fontWeight: 600,
            color: "#2C5545", margin: 0,
          }}
        >
          {titulo}
        </h3>
        <button
          onClick={onCerrar}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#999", padding: "4px", borderRadius: "6px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="flex flex-col min-h-0" style={{ flex: 1 }}>
        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto" style={{ flex: 1, minHeight: 0 }}>
          {children}
        </div>

        {/* Footer */}
        <div
          className="flex gap-3 px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid rgba(44,85,69,0.1)" }}
        >
          <button
            type="button"
            onClick={onCerrar}
            disabled={cargando}
            style={{
              flex: 1, padding: "10px", borderRadius: "8px",
              border: "1px solid rgba(44,85,69,0.2)", backgroundColor: "white",
              fontFamily: "'Lato', sans-serif", fontSize: "13px", fontWeight: 600,
              color: "#555", cursor: cargando ? "not-allowed" : "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={cargando}
            style={{
              flex: 1, padding: "10px", borderRadius: "8px",
              border: "none", backgroundColor: cargando ? "#aaa" : "#2C5545",
              fontFamily: "'Lato', sans-serif", fontSize: "13px", fontWeight: 600,
              color: "white", cursor: cargando ? "not-allowed" : "pointer",
            }}
          >
            {cargando ? "Guardando..." : textoGuardar}
          </button>
        </div>
      </form>
    </ModalBase>
  );
}

interface DetailModalProps {
  abierto: boolean;
  titulo?: string;
  onCerrar?: () => void;
  maxWidth?: string;
  children: ReactNode;
}

export function DetailModal({ abierto, titulo, onCerrar, maxWidth = "480px", children }: DetailModalProps) {
  if (!abierto) return null;

  return (
    <ModalBase onClose={onCerrar} maxWidth={maxWidth}>
      <div
        className="flex items-center justify-between px-6 py-4 shrink-0"
        style={{ borderBottom: "1px solid rgba(44,85,69,0.1)" }}
      >
        <h3
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "17px", fontWeight: 600,
            color: "#2C5545", margin: 0,
          }}
        >
          {titulo}
        </h3>
        <button
          onClick={onCerrar}
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "#999", padding: "4px", borderRadius: "6px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="px-6 py-5 flex flex-col gap-3 overflow-y-auto" style={{ minHeight: 0 }}>
        {children}
      </div>
    </ModalBase>
  );
}
