import { useState, type FormEvent, type FocusEvent } from "react";
import { X, Tag } from "lucide-react";
import { esSoloAlfanumerico, LIMITES, MENSAJES } from "../../utils/validators";
import { getErrorMessage } from "../../utils/errors";

interface CategoryModalProps {
  onClose: () => void;
  onSave: (nombre: string) => Promise<void>;
}

export function CategoryModal({ onClose, onSave }: CategoryModalProps) {
  const [name, setName]       = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  const validarNombre = (trimmed: string): string | null => {
    if (!trimmed) return "El nombre es obligatorio.";
    if (trimmed.length < 2) return "Minimo 2 caracteres.";
    if (!esSoloAlfanumerico(trimmed)) return MENSAJES.SOLO_ALFANUMERICO;
    return null;
  };

  const handleBlur = (_e: FocusEvent<HTMLInputElement>) => {
    const msg = validarNombre(name.trim());
    setError(msg || "");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    const msg = validarNombre(trimmed);
    if (msg) { setError(msg); return; }
    setLoading(true);
    setError("");
    try {
      await onSave(trimmed);
    } catch (err) {
      setError(getErrorMessage(err, "Error al crear"));
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }}>
      <div style={{ backgroundColor: "#F8F4EE", borderRadius: 12,
        boxShadow: "0 20px 60px rgba(44,85,69,0.18)", width: 420, maxWidth: "calc(100vw - 32px)" }}>

        <div style={{ borderBottom: "1px solid rgba(44,85,69,0.12)", padding: "20px 24px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="flex items-center gap-3">
            <div style={{ backgroundColor: "rgba(201,168,76,0.15)", borderRadius: 8 }}
              className="w-9 h-9 flex items-center justify-center">
              <Tag size={18} style={{ color: "#C9A84C" }} />
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: "#2C5545", fontSize: 18, fontWeight: 600 }}>
              Nueva Categoria
            </h2>
          </div>
          <button onClick={onClose} disabled={loading}
            style={{ color: "rgba(44,85,69,0.45)", borderRadius: 6 }}
            className="w-8 h-8 flex items-center justify-center hover:bg-teal-50 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-5">
            <label style={{ fontFamily: "'Lato', sans-serif", color: "#2C5545", fontSize: 13,
              fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Nombre de la categoria
            </label>
            <input type="text" value={name}
              onChange={(e) => { setName(e.target.value); if (error) setError(""); }}
              onBlur={handleBlur}
              maxLength={LIMITES.NOMBRE_CATEGORIA}
              placeholder="Ej: Bebidas, Postres, Entradas..."
              disabled={loading} autoFocus
              style={{ fontFamily: "'Lato', sans-serif", width: "100%", padding: "10px 14px",
                borderRadius: 8, border: error ? "1.5px solid #d4183d" : "1.5px solid rgba(44,85,69,0.25)",
                backgroundColor: loading ? "rgba(44,85,69,0.04)" : "#fff",
                color: "#2C5545", fontSize: 14, outline: "none" }}
              onFocus={(e) => { if (!error) e.target.style.borderColor = "#C9A84C"; }}
            />
            {error && <p style={{ fontFamily: "'Lato', sans-serif", color: "#d4183d", fontSize: 12, marginTop: 5 }}>{error}</p>}
            <p style={{ fontFamily: "'Lato', sans-serif", color: "rgba(44,85,69,0.5)", fontSize: 12, marginTop: 6 }}>
              La categoria se creara como activa por defecto.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} disabled={loading}
              style={{ fontFamily: "'Lato', sans-serif", color: "#2C5545",
                border: "1.5px solid rgba(44,85,69,0.3)", borderRadius: 8, padding: "9px 20px",
                fontSize: 14, backgroundColor: "transparent", cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1 }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              style={{ fontFamily: "'Lato', sans-serif",
                backgroundColor: loading ? "rgba(44,85,69,0.5)" : "#2C5545",
                color: "#F8F4EE", borderRadius: 8, padding: "9px 20px", fontSize: 14,
                border: "none", cursor: loading ? "not-allowed" : "pointer", minWidth: 140 }}>
              {loading ? "Creando..." : "Crear categoria"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
