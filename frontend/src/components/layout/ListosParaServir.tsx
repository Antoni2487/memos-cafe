import { useCallback, useEffect, useRef, useState } from "react";
import { BellRing, Check, ChevronDown } from "lucide-react";
import comandasService from "../../services/comandasService";
import authService from "../../services/authService";
import useStaffSocket from "../../hooks/useStaffSocket";
import { useReloj } from "../../hooks/useReloj";
import { guardarListas, useListosParaServir } from "../../hooks/listosParaServir";
import { sonarTimbre } from "../../utils/sonido";
import { getErrorMessage } from "../../utils/errors";
import type { ComandaCocina } from "../../types";

const POLL_MS = 20000; // respaldo si el tiempo real no está disponible
// Si nadie lo recoge, vuelve a sonar y cambia de color.
const RECORDAR_SEG = 2 * 60;
const URGENTE_SEG = 5 * 60;
const VISIBLES = 3;

function destino(c: ComandaCocina): string {
  if (c.tipo_orden === "mesa") return `Mesa ${c.mesa_numero ?? "?"}`;
  const tipo = c.tipo_orden === "delivery" ? "Delivery" : "Para llevar";
  return c.cliente_nombre ? `${tipo} · ${c.cliente_nombre}` : tipo;
}

/** Nivel de aviso que ya le corresponde a una comanda según su espera. */
const nivel = (seg: number) => (seg >= URGENTE_SEG ? 2 : seg >= RECORDAR_SEG ? 1 : 0);

/**
 * "Listo para servir": cuando Cocina termina una ronda, a todos los meseros
 * les aparece arriba, en cualquier pantalla, con timbre de cocina. Se queda
 * hasta que alguien toca "Servido" (y entonces desaparece para todos). Si
 * nadie la recoge, vuelve a sonar a los 2 y a los 5 minutos.
 */
export default function ListosParaServir() {
  const usuario = authService.getUser();
  const habilitado = ["admin", "mesero"].some((r) => usuario.roles.includes(r));
  const listas = useListosParaServir();
  const ahora = useReloj().getTime();
  const [cargadoEn, setCargadoEn] = useState(() => Date.now());
  const [sirviendo, setSirviendo] = useState<number | null>(null);
  const [verTodas, setVerTodas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Hasta qué nivel ya sonó cada comanda (0: al llegar, 1: 2 min, 2: 5 min).
  const avisadas = useRef<Map<number, number> | null>(null);

  const cargar = useCallback(() => {
    comandasService
      .listas()
      .then(({ data }) => {
        const antes = avisadas.current;
        const despues = new Map<number, number>();
        let nueva = false;
        for (const c of data) {
          const previo = antes?.get(c.id);
          if (previo === undefined) {
            // En la primera carga (o al recargar la página) no suena todo de
            // golpe: se da por avisado lo que ya estaba esperando.
            if (antes) nueva = true;
            despues.set(c.id, antes ? 0 : nivel(c.segundos.desde_lista ?? 0));
          } else {
            despues.set(c.id, previo);
          }
        }
        avisadas.current = despues;
        setCargadoEn(Date.now());
        guardarListas(data);
        if (nueva) sonarTimbre();
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
      if (evento.type === "comanda.actualizada") cargar();
    },
    habilitado
  );

  const espera = useCallback(
    (c: ComandaCocina) => (c.segundos.desde_lista ?? 0) + Math.max(0, Math.floor((ahora - cargadoEn) / 1000)),
    [ahora, cargadoEn]
  );

  // Recordatorio: vuelve a sonar una vez al cruzar los 2 y los 5 minutos.
  useEffect(() => {
    const mapa = avisadas.current;
    if (!mapa) return;
    let sonar = false;
    for (const c of listas) {
      const debe = nivel(espera(c));
      if (debe > (mapa.get(c.id) ?? 0)) {
        mapa.set(c.id, debe);
        sonar = true;
      }
    }
    if (sonar) sonarTimbre();
  }, [listas, espera]);

  const servir = async (c: ComandaCocina) => {
    setSirviendo(c.id);
    setError(null);
    try {
      await comandasService.entregar(c.id);
      guardarListas(listas.filter((x) => x.id !== c.id));
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo marcar como servido. Inténtalo de nuevo."));
    } finally {
      setSirviendo(null);
      cargar();
    }
  };

  if (!habilitado || listas.length === 0) return null;

  const mostradas = verTodas ? listas : listas.slice(0, VISIBLES);
  const ocultas = listas.length - mostradas.length;

  return (
    <section aria-label="Pedidos listos para servir" aria-live="assertive" className="mx-4 mt-3 flex flex-col gap-2 md:mx-6 lg:mx-8">
      {error && <p className="rounded-xl bg-peligro-fondo px-4 py-2 text-sm text-peligro">{error}</p>}
      {mostradas.map((c) => {
        const seg = espera(c);
        const min = Math.floor(seg / 60);
        const urgencia = nivel(seg);
        const tono = [
          "border-exito/30 bg-exito-fondo text-exito",
          "border-aviso/40 bg-aviso-fondo text-aviso",
          "border-peligro/40 bg-peligro-fondo text-peligro",
        ][urgencia];
        const tuya = c.mesero_id != null && String(c.mesero_id) === usuario.id;
        return (
          <div key={c.id} className={`flex items-center gap-3 rounded-2xl border p-3 shadow-suave sm:p-3.5 ${tono}`}>
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className={`hidden size-11 shrink-0 place-items-center rounded-xl bg-marfil sm:grid ${urgencia ? "animate-pulse" : ""}`}>
                <BellRing className="size-5.5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[17px] font-semibold text-espresso">
                  {destino(c)} lista para servir
                  {c.numero > 1 && <span className="text-sm font-medium text-suave">· ronda {c.numero}</span>}
                  {tuya && <span className="rounded-full bg-espresso px-2 py-0.5 text-[11px] font-bold tracking-wide text-marfil">TU MESA</span>}
                </p>
                <p className="line-clamp-2 text-sm text-espresso/80">
                  {c.detalles.map((d) => `${d.cantidad} ${d.nombre}`).join(", ")}
                </p>
                <p className="text-xs font-semibold">
                  {min < 1 ? "Recién salió de cocina" : `Esperando hace ${min} min`}
                  {!tuya && c.mesero ? ` · mesa de ${c.mesero}` : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => servir(c)}
              disabled={sirviendo === c.id}
              aria-label={`Servido: ${destino(c)}${c.numero > 1 ? ` ronda ${c.numero}` : ""}`}
              className="flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-salvia px-4 text-[15px] font-semibold text-marfil hover:bg-salvia-osc disabled:opacity-60 sm:px-5"
            >
              <Check className="size-5" /> {sirviendo === c.id ? "…" : "Servido"}
            </button>
          </div>
        );
      })}
      {(ocultas > 0 || verTodas) && listas.length > VISIBLES && (
        <button
          type="button"
          onClick={() => setVerTodas((v) => !v)}
          className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-linea bg-marfil text-sm font-semibold text-espresso"
        >
          <ChevronDown className={`size-4 transition-transform ${verTodas ? "rotate-180" : ""}`} />
          {verTodas ? "Ver menos" : `Ver ${ocultas} más por servir`}
        </button>
      )}
    </section>
  );
}
