import type { Orden } from "../../types";

const PLATAFORMA: Record<string, string> = { rappi: "Rappi", pedidos_ya: "PedidosYa", didi: "DiDi Food" };

/** "Mesa 4", "Para llevar · Ana", "Delivery · Rappi · Luis". */
export function paraQuien(o: Orden): string {
  if (o.tipo_orden === "mesa") return `Mesa ${o.mesa_numero ?? "?"}`;
  const plataforma = o.plataforma_delivery ? PLATAFORMA[o.plataforma_delivery] ?? o.plataforma_otra ?? "" : "";
  const tipo = o.tipo_orden === "llevar" ? "Para llevar" : `Delivery${plataforma ? ` · ${plataforma}` : ""}`;
  return o.cliente_nombre ? `${tipo} · ${o.cliente_nombre}` : tipo;
}
