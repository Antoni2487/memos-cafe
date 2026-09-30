import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Search, X, TrendingDown, TrendingUp } from "lucide-react";

interface SearchBarProps {
  placeholder?: string;
  onBuscar?: (texto: string) => void;
  delay?: number;
  className?: string;
}

export function SearchBar({ placeholder = "Buscar…", onBuscar, delay = 400, className = "" }: SearchBarProps) {
  const [valor, setValor] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const texto = e.target.value;
    setValor(texto);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onBuscar?.(texto), delay);
  };

  const limpiar = () => {
    setValor("");
    if (timer.current) clearTimeout(timer.current);
    onBuscar?.("");
  };

  return (
    <label
      className={`flex h-11 w-full sm:w-auto sm:min-w-60 items-center gap-2.5 rounded-xl border border-linea-fuerte bg-marfil px-3.5 transition-colors focus-within:border-salvia focus-within:ring-3 focus-within:ring-salvia/15 ${className}`}
    >
      <Search className="size-4 shrink-0 text-tenue" aria-hidden />
      <input
        type="search"
        value={valor}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-base sm:text-sm text-espresso placeholder:text-tenue outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {valor && (
        <button type="button" onClick={limpiar} aria-label="Limpiar búsqueda" className="-mr-1 grid size-7 place-items-center rounded-full text-tenue hover:bg-arena">
          <X className="size-3.5" />
        </button>
      )}
    </label>
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
  const colorTendencia = tendencia === "up" ? "text-exito" : tendencia === "down" ? "text-peligro" : "text-suave";

  return (
    <div className="min-w-0 flex-1 rounded-2xl border border-linea bg-marfil p-4 sm:p-5 shadow-suave">
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-suave">{titulo}</p>
        {icono && (
          <span className="hidden sm:grid size-9 shrink-0 place-items-center rounded-xl bg-salvia-clara text-salvia-osc [&_svg]:size-4.5">
            {icono}
          </span>
        )}
      </div>
      <p className="font-display text-[26px] sm:text-[28px] font-semibold leading-none text-espresso tabular-nums">
        {valor ?? "—"}
      </p>
      {subtitulo && (
        <p className={`mt-2 flex items-center gap-1 text-xs ${colorTendencia}`}>
          {tendencia === "up" && <TrendingUp className="size-3.5" />}
          {tendencia === "down" && <TrendingDown className="size-3.5" />}
          {subtitulo}
        </p>
      )}
    </div>
  );
}
