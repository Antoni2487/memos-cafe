import { useCallback, useEffect, useRef, useState } from "react";
import { Check, QrCode, X } from "lucide-react";
import mesasService, { type PedidoPorConfirmar } from "../../services/mesasService";
import useStaffSocket from "../../hooks/useStaffSocket";
import authService from "../../services/authService";
import { sonarAviso } from "../../utils/sonido";
import { getErrorMessage } from "../../utils/errors";

const POLL_MS = 20000; // respaldo si el tiempo real no está disponible

const soles = (n: string | number) => `S/ ${Number(n).toFixed(2)}`;

/**
 * Primer pedido por QR de una mesa libre: aparece arriba en cualquier
 * pantalla del personal de sala, con sonido, para confirmarlo con un toque
 * (hay gente sentada → pasa a cocina) o rechazarlo (mesa vacía).
 */
export default function PedidosPorConfirmar() {
  const roles = authService.getUser().roles;
  const habilitado = ["admin", "mesero", "cajero"].some((r) => roles.includes(r));
  const [pedidos, setPedidos] = useState<PedidoPorConfirmar[]>([]);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const conocidos = useRef<Set<number> | null>(null);

  const cargar = useCallback(() => {
    mesasService
      .porConfirmar()
      .then(({ data }) => {
        // Suena solo por pedidos nuevos, no en la primera carga ni al repetir.
        if (conocidos.current && data.some((p) => !conocidos.current!.has(p.id))) sonarAviso();
        conocidos.current = new Set(data.map((p) => p.id));
        setPedidos(data);
      })
      .catch(() => { /* silencioso: se reintenta */ });
  }, []);

  useEffect(() => {
    if (!habilitado) return;
    cargar();
    const iv = setInterval(cargar, POLL_MS);
    return () => clearInterval(iv);
  }, [habilitado, cargar]);

  useStaffSocket(
    "meseros",
    (evento) => {
      if (evento.type === "pedido.por_confirmar" || evento.type === "pedido.por_confirmar_resuelto") cargar();
    },
    habilitado
  );

  const resolver = async (pedido: PedidoPorConfirmar, confirmar: boolean) => {
    setOcupado(pedido.id);
    setError(null);
    try {
      if (confirmar) await mesasService.confirmarPedido(pedido.id);
      else await mesasService.rechazarPedido(pedido.id);
      setPedidos((prev) => prev.filter((p) => p.id !== pedido.id));
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo. Inténtalo de nuevo."));
      cargar();
    } finally {
      setOcupado(null);
    }
  };

  if (!habilitado || pedidos.length === 0) return null;

  return (
    <section aria-label="Pedidos por confirmar" aria-live="polite" className="mx-4 mt-3 flex flex-col gap-2 md:mx-6 lg:mx-8">
      {error && <p className="rounded-xl bg-peligro-fondo px-4 py-2 text-sm text-peligro">{error}</p>}
      {pedidos.map((p) => {
        const resumen = p.items.map((i) => `${i.cantidad} ${i.nombre}`).join(", ");
        const minutos = Math.floor(p.segundos_esperando / 60);
        return (
          <div
            key={p.id}
            className="flex flex-col gap-3 rounded-2xl border border-aviso/30 bg-aviso-fondo p-3.5 shadow-suave sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-marfil text-aviso">
                <QrCode className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-espresso">
                  Mesa {p.mesa_numero} pidió por QR · {soles(p.total)}
                </p>
                <p className="truncate text-sm text-suave">
                  {resumen}
                  {minutos > 0 && ` · hace ${minutos} min`}
                </p>
                <p className="text-xs text-aviso">¿Hay gente en la mesa? Confírmalo para que pase a cocina.</p>
              </div>
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <button
                type="button"
                onClick={() => resolver(p, false)}
                disabled={ocupado === p.id}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-linea-fuerte bg-marfil px-4 text-sm font-semibold text-espresso disabled:opacity-60 sm:flex-none"
              >
                <X className="size-4" /> Mesa vacía
              </button>
              <button
                type="button"
                onClick={() => resolver(p, true)}
                disabled={ocupado === p.id}
                className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-salvia px-4 text-sm font-semibold text-marfil disabled:opacity-60 sm:flex-none"
              >
                <Check className="size-4" /> {ocupado === p.id ? "…" : "Confirmar"}
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
