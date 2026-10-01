import type { GeometriaPlano, MesaPlano } from "../../../types";

// Lo que el mesero tiene que ver primero en cada mesa, de más a menos urgente.
export type Situacion = "por_confirmar" | "lista" | "cuenta" | "demorada" | "ocupada" | "reservada" | "libre";

export const MIN_DEMORA = 20; // mismo umbral rojo que Cocina

export function situacion(m: MesaPlano, ahora: number): Situacion {
  const s = m.sala;
  if (s?.pedido_por_confirmar_id) return "por_confirmar";
  if (s?.orden_id) {
    if (s.comandas.lista > 0) return "lista";
    if (s.pide_cuenta) return "cuenta";
    const enCocina = s.comandas.pendiente + s.comandas.en_preparacion;
    if (enCocina > 0 && s.comanda_esperando_desde && minutosDesde(s.comanda_esperando_desde, ahora) >= MIN_DEMORA) {
      return "demorada";
    }
    return "ocupada";
  }
  if (m.estado === "ocupada") return "ocupada";
  if (m.estado === "reservada") return "reservada";
  return "libre";
}

export const ETIQUETA: Record<Situacion, string> = {
  por_confirmar: "Pidió por QR",
  lista: "Pedido listo",
  cuenta: "Por cobrar",
  demorada: "Demorada",
  ocupada: "Ocupada",
  reservada: "Reservada",
  libre: "Libre",
};

export const URGENCIA: Record<Situacion, number> = {
  por_confirmar: 0, lista: 1, cuenta: 2, demorada: 3, ocupada: 4, reservada: 5, libre: 6,
};

export function minutosDesde(iso: string, ahora: number): number {
  return Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 60000));
}

export function duracion(iso: string | null, ahora: number): string {
  if (!iso) return "";
  const min = minutosDesde(iso, ahora);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

export const soles = (n: string | number | null) => `S/ ${Number(n ?? 0).toFixed(2)}`;

/**
 * Las mesas sin ubicar (recién creadas o de antes del croquis) se acomodan
 * en una grilla a la derecha, para que el plano nunca salga vacío.
 */
export function conPosicion<T extends GeometriaPlano & { numero: number }>(mesas: T[], ancho: number, alto: number): T[] {
  const sinUbicar = mesas.filter((m) => m.plano_x === null || m.plano_y === null).sort((a, b) => a.numero - b.numero);
  if (sinUbicar.length === 0) return mesas;
  const columnas = Math.max(1, Math.ceil(Math.sqrt(sinUbicar.length * (ancho / alto))));
  const paso = Math.min(140, (ancho - 80) / columnas);
  const posiciones = new Map<number, { x: number; y: number }>();
  sinUbicar.forEach((m, i) => {
    posiciones.set(m.numero, {
      x: Math.round(60 + paso / 2 + (i % columnas) * paso),
      y: Math.round(70 + Math.floor(i / columnas) * Math.min(140, paso)),
    });
  });
  return mesas.map((m) => {
    const p = posiciones.get(m.numero);
    return p ? { ...m, plano_x: Math.min(p.x, ancho - 40), plano_y: Math.min(p.y, alto - 40) } : m;
  });
}
