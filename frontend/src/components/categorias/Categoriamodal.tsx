import { useState, type FormEvent } from "react";
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

  const handleBlur = () => {
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
      <div style={{ backgroundColor: "var(--beige)", borderRadius: 12,
        boxShadow: "0 20px 60px var(--linea-fuerte)", width: 420, maxWidth: "calc(100vw - 32px)" }}>

        <div style={{ borderBottom: "1px solid rgba(76,107,101,0.12)", padding: "20px 24px 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="flex items-center gap-3">
            <div style={{ backgroundColor: "rgba(140,108,58,0.15)", borderRadius: 8 }}
              className="w-9 h-9 flex items-center justify-center">
              <Tag size={18} style={{ color: "var(--champan)" }} />
            </div>
            <h2 style={{ fontFamily: "var(--font-titulos)", color: "var(--espresso)", fontSize: 18, fontWeight: 600 }}>
              Nueva Categoria
            </h2>
          </div>
          <button onClick={onClose} disabled={loading}
            style={{ color: "var(--suave)", borderRadius: 6 }}
            className="w-8 h-8 flex items-center justify-center hover:bg-teal-50 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-5">
            <label style={{ fontFamily: "var(--font-texto)", color: "var(--salvia)", fontSize: 13,
              fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", display: "block", marginBottom: 6 }}>
              Nombre de la categoria
            </label>
            <input type="text" value={name}
              onChange={(e) => { setName(e.target.value); if (error) setError(""); }}
              onBlur={handleBlur}
              maxLength={LIMITES.NOMBRE_CATEGORIA}
              placeholder="Ej: Bebidas, Postres, Entradas..."
              disabled={loading} autoFocus
              style={{ fontFamily: "var(--font-texto)", width: "100%", padding: "10px 14px",
                borderRadius: 8, border: error ? "1.5px solid var(--peligro)" : "1.5px solid var(--linea-fuerte)",
                backgroundColor: loading ? "rgba(76,107,101,0.04)" : "#fff",
                color: "var(--salvia)", fontSize: 14, outline: "none" }}
              onFocus={(e) => { if (!error) e.target.style.borderColor = "var(--champan)"; }}
            />
            {error && <p style={{ fontFamily: "var(--font-texto)", color: "var(--peligro)", fontSize: 12, marginTop: 5 }}>{error}</p>}
            <p style={{ fontFamily: "var(--font-texto)", color: "var(--suave)", fontSize: 12, marginTop: 6 }}>
              La categoria se creara como activa por defecto.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} disabled={loading}
              style={{ fontFamily: "var(--font-texto)", color: "var(--salvia)",
                border: "1.5px solid var(--linea-fuerte)", borderRadius: 8, padding: "9px 20px",
                fontSize: 14, backgroundColor: "transparent", cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1 }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              style={{ fontFamily: "var(--font-texto)",
                backgroundColor: loading ? "var(--suave)" : "var(--salvia)",
                color: "var(--beige)", borderRadius: 8, padding: "9px 20px", fontSize: 14,
                border: "none", cursor: loading ? "not-allowed" : "pointer", minWidth: 140 }}>
              {loading ? "Creando..." : "Crear categoria"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
