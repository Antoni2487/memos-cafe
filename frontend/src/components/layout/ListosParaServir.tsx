import { ChefHat } from "lucide-react";
import authService from "../../services/authService";
import useAvisosListos, { nivelDeEspera } from "../../hooks/useAvisosListos";
import Notificacion, { type Urgencia } from "../notificaciones/Notificacion";
import PilaNotificaciones from "../notificaciones/PilaNotificaciones";
import { haceCuanto, listaNatural, ordinal } from "../notificaciones/texto";
import type { ComandaCocina } from "../../types";

const URGENCIA: Urgencia[] = ["normal", "atencion", "urgente"];

function paraQuien(c: ComandaCocina): string {
  if (c.tipo_orden === "mesa") return `Mesa ${c.mesa_numero ?? "?"}`;
  const tipo = c.tipo_orden === "delivery" ? "Delivery" : "Para llevar";
  return c.cliente_nombre ? `${tipo} · ${c.cliente_nombre}` : tipo;
}

/**
 * "Listo para servir": cuando Cocina termina una ronda, a todos los meseros
 * les llega una notificación arriba de cualquier pantalla, con timbre.
 * Se marca servida con el botón o deslizándola, y desaparece para todos.
 */
export default function ListosParaServir() {
  const usuario = authService.getUser();
  const habilitado = ["admin", "mesero"].some((r) => usuario.roles.includes(r));
  const { listas, esperaDe, servir, error } = useAvisosListos(habilitado);

  if (!habilitado || (listas.length === 0 && !error)) return null;

  return (
    <div aria-live="polite" className="mx-3 mt-3 flex max-w-xl flex-col gap-2 md:mx-6 lg:mx-8">
      <PilaNotificaciones titulo="Por servir">
        {listas.map((c) => {
          const nombre = paraQuien(c);
          const seg = esperaDe(c);
          const urgencia = URGENCIA[nivelDeEspera(seg)];
          const tuya = c.mesero_id != null && String(c.mesero_id) === usuario.id;
          const lo = listaNatural(c.detalles.map((d) => `${d.cantidad} ${d.nombre}`));
          return (
            <Notificacion
              key={c.id}
              ariaLabel={`${nombre} lista para servir`}
              icono={<ChefHat className="size-5.5" strokeWidth={1.9} />}
              origen="Cocina"
              hora={urgencia === "normal" ? haceCuanto(seg) : `${haceCuanto(seg)} esperando`}
              urgencia={urgencia}
              titulo={nombre}
              etiqueta={tuya ? "Tu mesa" : undefined}
              pie={!tuya && c.mesero ? `Mesa de ${c.mesero}` : undefined}
              deslizar={{ etiqueta: "Servido", accion: () => servir(c, nombre) }}
              acciones={[
                {
                  etiqueta: "Servido",
                  primaria: true,
                  cierra: true,
                  ariaLabel: `Marcar ${nombre} como servida`,
                  onClick: () => servir(c, nombre),
                },
              ]}
            >
              {c.numero > 1 ? `La ${ordinal(c.numero)} ronda ya está lista: ` : "Ya está lista: "}
              {lo}
            </Notificacion>
          );
        })}
      </PilaNotificaciones>
      {error && (
        <p role="alert" className="notif-entrar rounded-2xl bg-espresso px-4 py-3 text-sm font-medium text-marfil shadow-alta">
          {error}
        </p>
      )}
    </div>
  );
}
