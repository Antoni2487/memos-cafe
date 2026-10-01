import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ClipboardPlus, QrCode, Receipt, X } from "lucide-react";
import { DetailModal } from "../../../components/common";
import MesaQRCodigo from "../../../components/mesas/MesaQRCodigo";
import mesasService, { type PedidoPorConfirmar } from "../../../services/mesasService";
import comandasService from "../../../services/comandasService";
import authService from "../../../services/authService";
import { urlPedidoQR } from "../../../services/pedidoQRService";
import { getErrorMessage } from "../../../utils/errors";
import { useReloj } from "../../../hooks/useReloj";
import { duracion, ETIQUETA, situacion, soles } from "./estadoMesa";
import type { ComandaCocina, EstadoComanda, MesaPlano } from "../../../types";

const ESTADO_RONDA: Record<EstadoComanda, { label: string; clase: string }> = {
  pendiente: { label: "En cola", clase: "bg-arena text-suave" },
  en_preparacion: { label: "Preparando", clase: "bg-info-fondo text-info" },
  lista: { label: "Lista para servir", clase: "bg-exito-fondo text-exito" },
  entregada: { label: "Servida", clase: "bg-arena text-tenue" },
};

/** Lo que pasa en una mesa y lo que se puede hacer con ella. */
export default function FichaMesa({ mesa, onCerrar, onCambio }: { mesa: MesaPlano; onCerrar: () => void; onCambio: () => void }) {
  const navigate = useNavigate();
  const ahora = useReloj().getTime();
  const sala = mesa.sala;
  const s = situacion(mesa, ahora);
  const [rondas, setRondas] = useState<ComandaCocina[] | null>(null);
  const [porConfirmar, setPorConfirmar] = useState<PedidoPorConfirmar | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verQR, setVerQR] = useState(false);
  const puedeCobrar = authService.hasRole("admin") || authService.hasRole("cajero");

  const ordenId = sala?.orden_id ?? null;
  const pedidoId = sala?.pedido_por_confirmar_id ?? null;
  // Firma de lo que cambió en la mesa: si llega un cambio en vivo, se
  // vuelve a pedir el detalle.
  const firma = JSON.stringify(sala);

  const cargar = useCallback(() => {
    if (ordenId) comandasService.deOrden(ordenId).then(({ data }) => setRondas(data)).catch(() => {});
    if (pedidoId) {
      mesasService.porConfirmar()
        .then(({ data }) => setPorConfirmar(data.find((p) => p.id === pedidoId) ?? null))
        .catch(() => {});
    }
  }, [ordenId, pedidoId]);

  useEffect(() => { cargar(); }, [cargar, firma]);

  const hacer = async (fn: () => Promise<unknown>, cerrar = false) => {
    setOcupado(true);
    setError(null);
    try {
      await fn();
      onCambio();
      if (cerrar) onCerrar();
      else cargar();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo completar la acción"));
    } finally {
      setOcupado(false);
    }
  };

  const btn = "flex h-12 min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold disabled:opacity-60";
  const primario = `${btn} bg-salvia text-marfil active:bg-salvia-osc`;
  const secundario = `${btn} border border-linea-fuerte bg-marfil text-espresso active:bg-arena`;

  return (
    <>
      <DetailModal abierto titulo={`Mesa ${mesa.numero}`} onCerrar={onCerrar} maxWidth="520px">
        <div className="-mt-1 flex flex-wrap items-center gap-2 text-sm text-suave">
          <span className="rounded-full bg-arena px-2.5 py-1 font-medium text-espresso">{ETIQUETA[s]}</span>
          <span>{mesa.capacidad} personas</span>
          {sala?.orden_id && <span>· abierta hace {duracion(sala.abierta_en, ahora)}</span>}
          {sala?.mesero && <span>· {sala.mesero}</span>}
        </div>

        {error && <p role="alert" className="rounded-xl bg-peligro-fondo px-3.5 py-2.5 text-sm text-peligro">{error}</p>}

        {/* Primer pedido por QR esperando confirmación */}
        {pedidoId && (
          <section className="rounded-2xl border border-aviso/30 bg-aviso-fondo p-4">
            <p className="font-semibold text-aviso">Pidieron por QR · ¿hay gente en la mesa?</p>
            {porConfirmar && (
              <ul className="mt-2 text-[15px] text-espresso">
                {porConfirmar.items.map((i, n) => (
                  <li key={n}>
                    {i.cantidad} × {i.nombre}
                    {i.nota && <span className="text-sm italic text-suave"> — {i.nota}</span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" disabled={ocupado} className={secundario} onClick={() => hacer(() => mesasService.rechazarPedido(pedidoId))}>
                <X className="size-4" /> Mesa vacía
              </button>
              <button type="button" disabled={ocupado} className={primario} onClick={() => hacer(() => mesasService.confirmarPedido(pedidoId))}>
                <Check className="size-4" /> Confirmar
              </button>
            </div>
          </section>
        )}

        {/* Rondas de la orden */}
        {ordenId && (
          <section className="flex flex-col gap-2.5">
            {rondas === null ? (
              <p className="py-4 text-center text-sm text-tenue">Cargando pedido…</p>
            ) : (
              [...rondas].reverse().map((r) => (
                <div key={r.id} className="rounded-2xl border border-linea p-3.5">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-espresso">
                      Ronda {r.numero}{r.origen === "qr" && <span className="font-normal text-suave"> · por QR</span>}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_RONDA[r.estado].clase}`}>
                      {ESTADO_RONDA[r.estado].label}
                    </span>
                  </div>
                  <ul className="text-[15px] text-espresso">
                    {r.detalles.map((d) => (
                      <li key={d.id}>
                        {d.cantidad} × {d.nombre}
                        {d.nota && <span className="text-sm italic text-suave"> — {d.nota}</span>}
                      </li>
                    ))}
                  </ul>
                  {r.estado === "lista" && (
                    <button type="button" disabled={ocupado} className={`${primario} mt-3 w-full`} onClick={() => hacer(() => comandasService.entregar(r.id))}>
                      <Check className="size-4" /> Ya la serví
                    </button>
                  )}
                </div>
              ))
            )}
            <div className="flex items-baseline justify-between px-1 pt-1">
              <span className="text-sm text-suave">Total</span>
              <span className="font-display text-2xl font-semibold text-espresso tabular-nums">{soles(sala?.total ?? 0)}</span>
            </div>
            {sala?.pide_cuenta && (
              <p className="flex items-center gap-2 rounded-xl bg-champan-claro px-3.5 py-2.5 text-sm font-medium text-champan">
                <Receipt className="size-4" /> Pidieron la cuenta
              </p>
            )}
          </section>
        )}

        {/* Acciones */}
        <div className="flex flex-col gap-2 pt-1">
          {s !== "por_confirmar" && (
            <button type="button" className={ordenId ? secundario : primario} onClick={() => navigate(`/ordenes?mesa=${mesa.id}`)}>
              <ClipboardPlus className="size-4.5" /> {ordenId ? "Agregar al pedido" : "Tomar pedido"}
            </button>
          )}
          {ordenId && puedeCobrar && (
            <button type="button" className={sala?.pide_cuenta ? primario : secundario} onClick={() => navigate(`/caja?orden=${ordenId}`)}>
              <Receipt className="size-4.5" /> Cobrar
            </button>
          )}
          <div className="grid auto-cols-fr grid-flow-col gap-2">
            {mesa.estado === "libre" && !pedidoId && (
              <button type="button" disabled={ocupado} className={secundario} onClick={() => hacer(() => mesasService.cambiarEstado(mesa.id, "reservada"), true)}>
                Reservar
              </button>
            )}
            {mesa.estado === "reservada" && (
              <button type="button" disabled={ocupado} className={secundario} onClick={() => hacer(() => mesasService.cambiarEstado(mesa.id, "libre"), true)}>
                Quitar reserva
              </button>
            )}
            <button type="button" className={secundario} onClick={() => setVerQR(true)}>
              <QrCode className="size-4.5" /> QR de la mesa
            </button>
          </div>
        </div>
      </DetailModal>

      <DetailModal abierto={verQR} titulo={`QR · Mesa ${mesa.numero}`} onCerrar={() => setVerQR(false)}>
        <MesaQRCodigo mesaNumero={mesa.numero} url={urlPedidoQR(mesa.codigo_qr)} />
      </DetailModal>
    </>
  );
}
