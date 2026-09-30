import { AtSign, ExternalLink, Globe } from "lucide-react";

// Enlaces configurables en Vercel (Settings → Environment Variables). La web
// no aparece hasta que se defina VITE_WEB_URL.
const WEB = import.meta.env.VITE_WEB_URL as string | undefined;
const INSTAGRAM =
  (import.meta.env.VITE_INSTAGRAM_URL as string | undefined) || "https://www.instagram.com/memos.coffeecix/";

export default function ConoceMemos({ onVerCarta }: { onVerCarta: () => void }) {
  return (
    <div className="flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center px-6 py-12 text-center">
      <img src="/logo-memos.png" alt="" className="size-28 rounded-full shadow-suave" />
      <h1 className="mt-6 font-display text-[32px] font-semibold leading-tight text-espresso">Memo's Coffee</h1>
      <p className="mt-1 text-[15px] tracking-wide text-champan">Coffee, postres &amp; champagne</p>
      <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-suave">
        Gracias por acompañarnos. Mientras esperas, conoce un poco más de nosotros.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        {WEB && (
          <a
            href={WEB}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-salvia px-5 text-[15px] font-semibold text-marfil"
          >
            <Globe className="size-4.5" />
            Visita nuestra web
            <ExternalLink className="size-4 opacity-70" />
          </a>
        )}
        {INSTAGRAM && (
          <a
            href={INSTAGRAM}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-linea-fuerte bg-marfil px-5 text-[15px] font-semibold text-espresso"
          >
            <AtSign className="size-4.5" />
            Síguenos en Instagram
          </a>
        )}
        <button
          type="button"
          onClick={onVerCarta}
          className={`h-13 rounded-2xl px-5 text-[15px] font-semibold ${
            WEB || INSTAGRAM ? "text-salvia-osc" : "bg-salvia text-marfil"
          }`}
        >
          Volver a la carta
        </button>
      </div>
    </div>
  );
}
