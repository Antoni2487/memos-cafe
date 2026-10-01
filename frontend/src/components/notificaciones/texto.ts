/** "2 Americano, 1 Capuchino y 1 Croissant" */
export function listaNatural(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

/** Hora relativa como en las notificaciones del teléfono. */
export function haceCuanto(segundos: number): string {
  if (segundos < 45) return "ahora";
  const minutos = Math.max(1, Math.round(segundos / 60));
  if (minutos < 60) return `hace ${minutos} min`;
  return `hace ${Math.floor(minutos / 60)} h`;
}

/** 2 → "2.ª" */
export const ordinal = (n: number) => `${n}.ª`;
