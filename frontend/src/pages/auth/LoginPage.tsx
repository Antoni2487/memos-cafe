import { useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import authService from "../../services/authService";

// ─── Flor individual SVG ──────────────────────────────────────────────────────
interface FlorProps {
  size?: number;
  opacity?: number;
  style?: CSSProperties;
}

function Flor({ size = 80, opacity = 0.12, style = {} }: FlorProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: size, height: size, opacity, ...style }}
    >
      {/* Pétalos externos */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <ellipse
          key={i}
          cx={50}
          cy={16}
          rx={9}
          ry={22}
          fill="white"
          transform={`rotate(${angle}, 50, 50)`}
        />
      ))}
      {/* Pétalos internos */}
      {[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((angle, i) => (
        <ellipse
          key={i}
          cx={50}
          cy={24}
          rx={6}
          ry={14}
          fill="white"
          transform={`rotate(${angle}, 50, 50)`}
        />
      ))}
      {/* Centro */}
      <circle cx={50} cy={50} r={11} fill="white" />
      <circle cx={50} cy={50} r={6} fill="none" stroke="white" strokeWidth={1.5} opacity={0.5} />
    </svg>
  );
}

// ─── Fondo con flores distribuidas en todo el espacio ────────────────────────
function FloralBackground() {
  // Grid de flores distribuidas uniformemente + algunas aleatorias para relleno
  const flores = [
    // Esquinas y bordes
    { top: "2%",  left: "1%",   size: 110, opacity: 0.13 },
    { top: "2%",  left: "22%",  size: 70,  opacity: 0.08 },
    { top: "2%",  left: "45%",  size: 90,  opacity: 0.11 },
    { top: "2%",  left: "68%",  size: 65,  opacity: 0.07 },
    { top: "2%",  left: "88%",  size: 100, opacity: 0.12 },

    // Segunda fila
    { top: "18%", left: "5%",   size: 75,  opacity: 0.09 },
    { top: "15%", left: "30%",  size: 55,  opacity: 0.06 },
    { top: "18%", left: "55%",  size: 85,  opacity: 0.10 },
    { top: "15%", left: "78%",  size: 60,  opacity: 0.07 },
    { top: "20%", left: "95%",  size: 80,  opacity: 0.09 },

    // Tercera fila — alrededor del card
    { top: "35%", left: "1%",   size: 95,  opacity: 0.11 },
    { top: "38%", left: "18%",  size: 60,  opacity: 0.07 },
    { top: "42%", left: "72%",  size: 70,  opacity: 0.08 },
    { top: "35%", left: "90%",  size: 90,  opacity: 0.10 },

    // Cuarta fila
    { top: "55%", left: "4%",   size: 70,  opacity: 0.09 },
    { top: "58%", left: "25%",  size: 50,  opacity: 0.06 },
    { top: "55%", left: "60%",  size: 80,  opacity: 0.10 },
    { top: "58%", left: "82%",  size: 55,  opacity: 0.07 },
    { top: "55%", left: "93%",  size: 75,  opacity: 0.09 },

    // Quinta fila
    { top: "72%", left: "8%",   size: 85,  opacity: 0.10 },
    { top: "70%", left: "35%",  size: 60,  opacity: 0.07 },
    { top: "72%", left: "65%",  size: 70,  opacity: 0.08 },
    { top: "70%", left: "88%",  size: 90,  opacity: 0.11 },

    // Fila inferior
    { top: "85%", left: "1%",   size: 100, opacity: 0.12 },
    { top: "88%", left: "20%",  size: 65,  opacity: 0.08 },
    { top: "85%", left: "42%",  size: 80,  opacity: 0.10 },
    { top: "88%", left: "65%",  size: 55,  opacity: 0.07 },
    { top: "85%", left: "85%",  size: 95,  opacity: 0.11 },
  ];

  return (
    <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
      {flores.map((f, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: f.top,
            left: f.left,
            transform: `rotate(${(i * 23) % 360}deg)`,
          }}
        >
          <Flor size={f.size} opacity={f.opacity} />
        </div>
      ))}
    </div>
  );
}

// ─── Íconos ───────────────────────────────────────────────────────────────────
function EnvelopeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Logo flor (igual al Sidebar) ────────────────────────────────────────────
function LogoFlor() {
  return (
    <svg width="52" height="52" viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="4" fill="white" opacity="0.9" />
      <ellipse cx="18" cy="8" rx="3.5" ry="5.5" fill="white" opacity="0.85" />
      <ellipse cx="18" cy="28" rx="3.5" ry="5.5" fill="white" opacity="0.85" />
      <ellipse cx="8" cy="18" rx="5.5" ry="3.5" fill="white" opacity="0.85" />
      <ellipse cx="28" cy="18" rx="5.5" ry="3.5" fill="white" opacity="0.85" />
      <ellipse cx="10.5" cy="10.5" rx="3.5" ry="5.5" transform="rotate(-45 10.5 10.5)" fill="white" opacity="0.75" />
      <ellipse cx="25.5" cy="25.5" rx="3.5" ry="5.5" transform="rotate(-45 25.5 25.5)" fill="white" opacity="0.75" />
      <ellipse cx="25.5" cy="10.5" rx="3.5" ry="5.5" transform="rotate(45 25.5 10.5)" fill="white" opacity="0.75" />
      <ellipse cx="10.5" cy="25.5" rx="3.5" ry="5.5" transform="rotate(45 10.5 25.5)" fill="white" opacity="0.75" />
      <circle cx="18" cy="18" r="3" fill="white" />
    </svg>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function LoginPage() {
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const navigate                      = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authService.login(email, password);
      navigate("/");
    } catch {
      setError("Correo o contraseña incorrectos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden px-4 py-8"
      style={{ backgroundColor: "#2C5545" }}
    >
      {/* Flores en todo el fondo */}
      <FloralBackground />

      {/* Card central */}
      <div
        className="relative w-full z-10"
        style={{ maxWidth: "440px" }}
      >
        {/* Encabezado verde con logo */}
        <div
          className="flex flex-col items-center pt-8 pb-6 px-8 rounded-t-2xl"
          style={{
            backgroundColor: "#234A3A",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div className="flex items-center gap-3 mb-1">
            <LogoFlor />
            <span
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "28px",
                fontWeight: 600,
                color: "white",
                letterSpacing: "0.04em",
              }}
            >
              Memo's
            </span>
          </div>
          <span
            style={{
              fontFamily: "'Lato', sans-serif",
              fontSize: "10px",
              letterSpacing: "0.22em",
              color: "rgba(255,255,255,0.5)",
              textTransform: "uppercase",
              marginTop: "2px",
            }}
          >
            Café
          </span>
        </div>

        {/* Tarjeta crema */}
        <div
          className="px-8 py-8 rounded-b-2xl"
          style={{
            backgroundColor: "#F8F4EE",
            boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
          }}
        >
          {/* Título */}
          <div className="text-center mb-7">
            <h1
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                color: "#2C5545",
                fontSize: "1.25rem",
                fontWeight: 500,
                letterSpacing: "0.02em",
                margin: 0,
              }}
            >
              Inicio de Sesión
            </h1>
            <div
              className="mx-auto mt-3"
              style={{
                width: 36,
                height: 1,
                backgroundColor: "#C9A84C",
                opacity: 0.6,
              }}
            />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                style={{
                  fontFamily: "'Lato', sans-serif",
                  fontSize: "11px",
                  color: "#5a5a5a",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Correo electrónico
              </label>
              <div
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-white transition-all"
                style={{ border: "1px solid #d8d8d8" }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#2C5545"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#d8d8d8"}
              >
                <span style={{ color: "#9a9a9a" }}><EnvelopeIcon /></span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  required
                  style={{
                    flex: 1,
                    outline: "none",
                    background: "transparent",
                    fontSize: "13.5px",
                    color: "#333",
                    fontFamily: "'Lato', sans-serif",
                    border: "none",
                  }}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div className="flex flex-col gap-1.5">
              <label
                style={{
                  fontFamily: "'Lato', sans-serif",
                  fontSize: "11px",
                  color: "#5a5a5a",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                Contraseña
              </label>
              <div
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg bg-white transition-all"
                style={{ border: "1px solid #d8d8d8" }}
              >
                <span style={{ color: "#9a9a9a" }}><LockIcon /></span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    flex: 1,
                    outline: "none",
                    background: "transparent",
                    fontSize: "13.5px",
                    color: "#333",
                    fontFamily: "'Lato', sans-serif",
                    border: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  style={{ color: "#9a9a9a", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p
                className="text-center rounded-lg py-2 px-3"
                style={{
                  fontSize: "12px",
                  color: "#c0392b",
                  backgroundColor: "#fdf0ef",
                  fontFamily: "'Lato', sans-serif",
                  border: "1px solid rgba(192,57,43,0.15)",
                }}
              >
                {error}
              </p>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg mt-1 transition-all"
              style={{
                backgroundColor: loading ? "#3d6b5f" : "#2C5545",
                color: "#F8F4EE",
                fontFamily: "'Lato', sans-serif",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                cursor: loading ? "not-allowed" : "pointer",
                border: "none",
                boxShadow: loading ? "none" : "0 4px 16px rgba(44,85,69,0.35)",
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#1E4A37"; }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#2C5545"; }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner /> Iniciando...
                </span>
              ) : (
                "Iniciar Sesión"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p
          className="text-center mt-5"
          style={{
            fontFamily: "'Lato', sans-serif",
            fontSize: "10px",
            letterSpacing: "0.16em",
            color: "rgba(255,255,255,0.35)",
            textTransform: "uppercase",
          }}
        >
          Coffee · Postres · Champagne
        </p>
      </div>
    </div>
  );
}
