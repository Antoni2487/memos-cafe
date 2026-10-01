import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ban, ClipboardPlus, Printer, Receipt, Trash2 } from "lucide-react";
import { ConfirmDialog, DetailModal, StatusBadge } from "../../components/common";
import ordenesService from "../../services/ordenesService";
import authService from "../../services/authService";
import { getErrorMessage } from "../../utils/errors";
import type { DetalleOrden, Orden } from "../../types";
import { paraQuien } from "./pedidos";

const soles = (n: number | string | undefined) => `S/ ${Number(n ?? 0).toFixed(2)}`;
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-PE", { hour: "numeric", minute: "2-digit" });

const nombreItem = (d: DetalleOrden) => d.producto?.nombre ?? d.promocion?.nombre ?? "Producto";

/** Ficha de un pedido: lo pedido por ronda, pagos y acciones. */
export default function DetallePedido({ orden, onCerrar, onCambio }: { orden: Orden; onCerrar: () => void; onCambio: (o?: Orden) => void }) {
  const navigate = useNavigate();
  const [actual, setActual] = useState(orden);
  const [confirmarAnular, setConfirmarAnular] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esAdmin = authService.hasRole("admin");
  const puedeCobrar = esAdmin || authService.hasRole("cajero");
  const puedeEditar = esAdmin || authService.hasRole("mesero");
  const abierta = actual.estado === "abierta";

  const rondas = new Map<number, DetalleOrden[]>();
  for (const d of actual.detalles) {
    const n = d.ronda ?? 1;
    if (!rondas.has(n)) rondas.set(n, []);
    rondas.get(n)!.push(d);
  }
  const pagado = (actual.pagos_resumen ?? []).filter((p) => p.estado === "completado").reduce((s, p) => s + Number(p.monto), 0);

  const quitar = async (d: DetalleOrden) => {
    setOcupado(true);
    setError(null);
    try {
      const { data } = await ordenesService.eliminarDetalle(actual.id, d.id);
      setActual(data);
      onCambio(data);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo quitar el producto"));
    } finally {
      setOcupado(false);
    }
  };

  const anular = async () => {
    setConfirmarAnular(false);
    setOcupado(true);
    try {
      const { data } = await ordenesService.anular(actual.id);
      onCambio(data);
      onCerrar();
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo anular el pedido"));
    } finally {
      setOcupado(false);
    }
  };

  const btn = "flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-60";

  return (
    <>
      <DetailModal abierto titulo={`${paraQuien(actual)}`} onCerrar={onCerrar} maxWidth="540px">
        <div className="-mt-1 flex flex-wrap items-center gap-2 text-sm text-suave">
          <StatusBadge estado={actual.estado} size="sm" />
          <span>Pedido #{actual.id} · {hora(actual.fecha_creacion)}</span>
          {actual.usuario_nombre && <span>· {actual.usuario_nombre}</span>}
        </div>
        {actual.tipo_orden === "delivery" && (actual.direccion_entrega || actual.cliente_telefono) && (
          <p className="rounded-xl bg-arena px-3.5 py-2.5 text-sm text-espresso">
            {actual.direccion_entrega}{actual.cliente_telefono ? ` · ${actual.cliente_telefono}` : ""}
          </p>
        )}
        {actual.cuenta_pedida && abierta && (
          <p className="rounded-xl bg-champan-claro px-3.5 py-2.5 text-sm font-semibold text-champan">
            Pidió la cuenta · quiere pagar con {actual.cuenta_pedida.metodo}
          </p>
        )}
        {error && <p role="alert" className="rounded-xl bg-peligro-fondo px-3.5 py-2.5 text-sm text-peligro">{error}</p>}

        {[...rondas.entries()].map(([n, detalles]) => (
          <section key={n} className="rounded-2xl border border-linea p-3.5">
            {rondas.size > 1 && <p className="mb-1.5 text-sm font-semibold text-espresso">Ronda {n}</p>}
            <ul className="flex flex-col gap-2">
              {detalles.map((d) => (
                <li key={d.id} className="flex items-start gap-3 text-[15px]">
                  <div className="min-w-0 flex-1">
                    <span className="text-espresso">{d.cantidad} × {nombreItem(d)}</span>
                    {d.nota && <span className="block text-sm italic text-suave">{d.nota}</span>}
                  </div>
                  {abierta && d.estado_preparacion && <StatusBadge estado={d.estado_preparacion} size="sm" />}
                  <span className="shrink-0 text-suave tabular-nums">{soles(d.subtotal)}</span>
                  {abierta && puedeEditar && d.estado_preparacion === "pendiente" && (
                    <button type="button" disabled={ocupado} onClick={() => quitar(d)} aria-label={`Quitar ${nombreItem(d)}`} className="-mr-1 grid size-8 shrink-0 place-items-center rounded-full text-tenue hover:bg-arena hover:text-peligro">
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="flex items-baseline justify-between px-1">
          <span className="text-sm text-suave">{pagado > 0 && abierta ? `Pagado ${soles(pagado)} · falta ${soles(Number(actual.total) - pagado)}` : "Total"}</span>
          <span className="font-display text-2xl font-semibold text-espresso tabular-nums">{soles(actual.total)}</span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {abierta && puedeEditar && (
            <button type="button" className={`${btn} border border-linea-fuerte bg-marfil text-espresso hover:bg-arena`} onClick={() => navigate(actual.tipo_orden === "mesa" && actual.mesa ? `/ordenes/nuevo?mesa=${actual.mesa}` : `/ordenes/nuevo?orden=${actual.id}`)}>
              <ClipboardPlus className="size-4" /> Agregar productos
            </button>
          )}
          {abierta && puedeCobrar && (
            <button type="button" className={`${btn} bg-salvia text-marfil hover:bg-salvia-osc`} onClick={() => navigate(`/caja?orden=${actual.id}`)}>
              <Receipt className="size-4" /> Cobrar {soles(Number(actual.total) - pagado)}
            </button>
          )}
          <button type="button" className={`${btn} border border-linea-fuerte bg-marfil text-espresso hover:bg-arena`} onClick={() => window.open(`/comanda/${actual.id}`, "_blank")}>
            <Printer className="size-4" /> Imprimir comanda
          </button>
          {abierta && esAdmin && (
            <button type="button" disabled={ocupado} className={`${btn} border border-peligro/30 text-peligro hover:bg-peligro-fondo`} onClick={() => setConfirmarAnular(true)}>
              <Ban className="size-4" /> Anular pedido
            </button>
          )}
        </div>
      </DetailModal>

      <ConfirmDialog
        abierto={confirmarAnular}
        titulo={`¿Anular el pedido #${actual.id}?`}
        descripcion="Se cancela todo lo pedido y, si era de una mesa, la mesa queda libre. No se puede deshacer."
        textoOk="Anular pedido"
        onConfirmar={anular}
        onCancelar={() => setConfirmarAnular(false)}
      />
    </>
  );
}
