import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

interface LoadingSpinnerProps {
  texto?: string;
  full?: boolean;
}

export function LoadingSpinner({ texto = "Cargando…", full = false }: LoadingSpinnerProps) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-3 ${full ? "min-h-[60vh]" : "min-h-40"}`}
    >
      <span className="size-8 animate-spin rounded-full border-3 border-salvia/20 border-t-salvia" aria-hidden />
      <p className="text-sm text-suave">{texto}</p>
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
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-arena text-suave [&_svg]:size-6">
        {icono ?? <Inbox strokeWidth={1.6} />}
      </span>
      <div className="max-w-xs">
        <p className="font-display text-base font-semibold text-espresso">{titulo}</p>
        {subtitulo && <p className="mt-1 text-sm text-suave">{subtitulo}</p>}
      </div>
      {accion}
    </div>
  );
}
