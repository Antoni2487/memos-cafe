import { LIMITES } from "../../utils/validators";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { isAxiosError } from "axios";
import authService from "../../services/authService";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authService.login(email, password);
      navigate("/");
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      if (status === 429) {
        setError("Demasiados intentos seguidos. Espera un minuto y vuelve a intentar.");
      } else if (status === undefined || status >= 500) {
        setError("No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.");
      } else {
        setError("Correo o contraseña incorrectos.");
      }
    } finally {
      setLoading(false);
    }
  };

  const campo =
    "flex h-12 items-center gap-3 rounded-xl border border-linea-fuerte bg-marfil px-3.5 transition-[border-color,box-shadow] focus-within:border-salvia focus-within:ring-3 focus-within:ring-salvia/15";

  return (
    <main
      className="flex min-h-dvh w-full flex-col items-center justify-center bg-beige px-5 py-10"
      style={{ paddingTop: "max(40px, env(safe-area-inset-top))" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src="/logo-memos.png"
            alt=""
            width={88}
            height={88}
            className="mb-4 size-22 rounded-full shadow-suave"
          />
          <h1 className="font-display text-[28px] font-semibold leading-tight text-espresso">Memo's Coffee</h1>
          <p className="mt-1 text-sm text-suave">Coffee, postres &amp; champagne</p>
        </div>

        <div className="rounded-3xl border border-linea bg-marfil/60 p-6 sm:p-7 shadow-suave">
          <h2 className="mb-5 text-[15px] font-semibold text-espresso">Ingresa con tu cuenta</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-[13px] font-medium text-espresso">Correo electrónico</label>
              <div className={campo}>
                <Mail className="size-4.5 shrink-0 text-tenue" aria-hidden />
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  value={email}
                  maxLength={LIMITES.EMAIL}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                  className="min-w-0 flex-1 bg-transparent text-base text-espresso placeholder:text-tenue outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[13px] font-medium text-espresso">Contraseña</label>
              <div className={campo}>
                <Lock className="size-4.5 shrink-0 text-tenue" aria-hidden />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  maxLength={LIMITES.PASSWORD}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="min-w-0 flex-1 bg-transparent text-base text-espresso placeholder:text-tenue outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="-mr-1.5 grid size-9 place-items-center rounded-lg text-tenue hover:bg-arena hover:text-espresso"
                >
                  {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="flex items-center gap-2 rounded-xl bg-peligro-fondo px-3.5 py-2.5 text-sm text-peligro">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="mt-1 flex h-12 items-center justify-center gap-2 rounded-xl bg-salvia text-[15px] font-semibold text-marfil transition-colors hover:bg-salvia-osc disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <span className="size-4 animate-spin rounded-full border-2 border-marfil/30 border-t-marfil" aria-hidden />}
              {loading ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-tenue">¿Olvidaste tu contraseña? Pídele a la administración que la restablezca.</p>
      </div>
    </main>
  );
}
