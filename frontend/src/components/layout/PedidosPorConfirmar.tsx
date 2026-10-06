import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode } from "lucide-react";
import mesasService, { type PedidoPorConfirmar } from "../../services/mesasService";
import useStaffSocket from "../../hooks/useStaffSocket";
import authService from "../../services/authService";
import { sonarAviso } from "../../utils/sonido";
import { getErrorMessage } from "../../utils/errors";
import Notificacion from "../notificaciones/Notificacion";
import PilaNotificaciones from "../notificaciones/PilaNotificaciones";
import { haceCuanto, listaNatural } from "../notificaciones/texto";

const POLL_MS = 20000; // respaldo si el tiempo real no está disponible

const soles = (n: string | number) => `S/ ${Number(n).toFixed(2)}`;

/**
 * Primer pedido por QR de una mesa libre: llega como notificación arriba de
 * cualquier pantalla del personal de sala, con sonido, para confirmarlo con
 * un toque (hay gente sentada → pasa a cocina) o rechazarlo (mesa vacía).
 */
export default function PedidosPorConfirmar() {
  const roles = authService.getUser().roles;
  // Solo los meseros confirman (ven la mesa). Si nadie lo hace en unos
  // minutos, al admin le llega a la campana (reportes/views.py, AlertasView).
  const habilitado = roles.includes("mesero");
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
    <div aria-live="polite" className="mx-3 mt-3 flex max-w-xl flex-col gap-2 md:mx-6 lg:mx-8">
      <PilaNotificaciones titulo="Pedidos por QR">
        {pedidos.map((p) => (
          <Notificacion
            key={p.id}
            ariaLabel={`Mesa ${p.mesa_numero} pidió por QR`}
            icono={<QrCode className="size-5" strokeWidth={1.9} />}
            colorIcono="champan"
            origen="Pedido por QR"
            hora={haceCuanto(p.segundos_esperando)}
            urgencia={p.segundos_esperando >= 120 ? "atencion" : "normal"}
            titulo={`Mesa ${p.mesa_numero}`}
            pie="¿Hay gente sentada? Confírmalo y pasa a cocina."
            ocupada={ocupado === p.id}
            acciones={[
              { etiqueta: "Mesa vacía", cierra: true, onClick: () => resolver(p, false) },
              { etiqueta: "Confirmar", primaria: true, cierra: true, onClick: () => resolver(p, true) },
            ]}
          >
            Pidió {listaNatural(p.items.map((i) => `${i.cantidad} ${i.nombre}`))} · {soles(p.total)}
          </Notificacion>
        ))}
      </PilaNotificaciones>
      {error && (
        <p role="alert" className="notif-entrar rounded-2xl bg-espresso px-4 py-3 text-sm font-medium text-marfil shadow-alta">
          {error}
        </p>
      )}
    </div>
  );
}
