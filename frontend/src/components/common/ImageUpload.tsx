import { useState, useRef, type ChangeEvent, type DragEvent, type MouseEvent } from "react";
import { ImagePlus, X, Upload } from "lucide-react";

const MAX_MB = 5;

interface ImageUploadProps {
  label?: string;
  value?: string | File | null;
  onChange?: (file: File | null) => void;
  error?: string | null;
}

export default function ImageUpload({ label = "Imagen", value, onChange, error }: ImageUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    typeof value === "string" ? value : null
  );
  const [arrastrando, setArrastrando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const procesarArchivo = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorLocal("El archivo debe ser una imagen");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrorLocal(`La imagen no debe superar los ${MAX_MB}MB`);
      return;
    }
    setErrorLocal(null);
    setPreviewUrl(URL.createObjectURL(file));
    onChange?.(file);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => procesarArchivo(e.target.files?.[0]);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setArrastrando(false);
    procesarArchivo(e.dataTransfer.files?.[0]);
  };

  const handleQuitar = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setPreviewUrl(null);
    setErrorLocal(null);
    onChange?.(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const mensajeError = error || errorLocal;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label
        style={{
          fontFamily: "'Lato', sans-serif",
          fontSize: 11,
          fontWeight: 700,
          color: "rgba(44,85,69,0.75)",
          letterSpacing: "0.07em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </label>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={handleDrop}
        style={{
          position: "relative",
          borderRadius: 10,
          border: `1.5px dashed ${
            mensajeError ? "#c62828" : arrastrando ? "#2C5545" : "rgba(44,85,69,0.25)"
          }`,
          backgroundColor: arrastrando ? "rgba(44,85,69,0.04)" : "#fafafa",
          cursor: "pointer",
          overflow: "hidden",
          transition: "border-color 0.15s, background-color 0.15s",
          minHeight: previewUrl ? 140 : 110,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          style={{ display: "none" }}
        />

        {previewUrl ? (
          <div style={{ position: "relative", width: "100%", height: 140 }}>
            <img
              src={previewUrl}
              alt="Vista previa"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: 0,
                transition: "opacity 0.15s, background-color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = "1";
                e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.45)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = "0";
                e.currentTarget.style.backgroundColor = "rgba(0,0,0,0)";
              }}
            >
              <span
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  backgroundColor: "white", borderRadius: 7,
                  padding: "6px 12px", fontFamily: "'Lato', sans-serif",
                  fontSize: 12, fontWeight: 600, color: "#2C5545",
                }}
              >
                <Upload size={13} strokeWidth={2} /> Cambiar
              </span>
              <button
                type="button"
                onClick={handleQuitar}
                title="Quitar imagen"
                style={{
                  width: 30, height: 30, borderRadius: 7, border: "none",
                  backgroundColor: "white", color: "#c62828", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <X size={15} strokeWidth={2} />
              </button>
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center"
            style={{ height: 110, gap: 6, padding: "0 16px", textAlign: "center" }}
          >
            <div
              style={{
                width: 36, height: 36, borderRadius: "50%",
                backgroundColor: "rgba(44,85,69,0.08)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#2C5545",
              }}
            >
              <ImagePlus size={17} strokeWidth={1.8} />
            </div>
            <p style={{ margin: 0, fontFamily: "'Lato', sans-serif", fontSize: 12.5, color: "#555" }}>
              Arrastra una imagen o{" "}
              <span style={{ color: "#2C5545", fontWeight: 600 }}>haz clic para elegir</span>
            </p>
            <p style={{ margin: 0, fontFamily: "'Lato', sans-serif", fontSize: 11, color: "rgba(44,85,69,0.45)" }}>
              PNG, JPG hasta {MAX_MB}MB
            </p>
          </div>
        )}
      </div>

      {mensajeError && (
        <p style={{ fontFamily: "'Lato', sans-serif", fontSize: 11.5, color: "#c62828", margin: 0 }}>
          {mensajeError}
        </p>
      )}
    </div>
  );
}
