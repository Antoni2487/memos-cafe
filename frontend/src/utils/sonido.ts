// Campanita corta hecha con Web Audio (sin archivos). El navegador solo deja
// sonar después de que la persona tocó la pantalla al menos una vez: el
// personal ya lo hizo al iniciar sesión, y por si acaso se "desbloquea" con
// el primer toque.
let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx ??= new Ctor();
  return ctx;
}

if (typeof window !== "undefined") {
  const desbloquear = () => {
    contexto()?.resume().catch(() => {});
    window.removeEventListener("pointerdown", desbloquear);
  };
  window.addEventListener("pointerdown", desbloquear);
}

/** Dos notas suaves (tipo "ding-dong"). */
export function sonarAviso() {
  const c = contexto();
  if (!c) return;
  c.resume().catch(() => {});
  const ahora = c.currentTime;
  [
    { f: 880, t: 0 },
    { f: 1318.5, t: 0.16 },
  ].forEach(({ f, t }) => {
    const osc = c.createOscillator();
    const vol = c.createGain();
    osc.type = "sine";
    osc.frequency.value = f;
    vol.gain.setValueAtTime(0.0001, ahora + t);
    vol.gain.exponentialRampToValueAtTime(0.25, ahora + t + 0.02);
    vol.gain.exponentialRampToValueAtTime(0.0001, ahora + t + 0.6);
    osc.connect(vol).connect(c.destination);
    osc.start(ahora + t);
    osc.stop(ahora + t + 0.65);
  });
}

/**
 * Timbre de cocina, para "pedido listo": dos golpes metálicos más fuertes y
 * largos que el aviso normal, para que se distinga sin mirar la pantalla.
 * En Android además vibra (Safari en iPhone no deja vibrar).
 */
export function sonarTimbre() {
  // El navegador solo deja vibrar después del primer toque en la página.
  const activado = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true;
  if (activado) {
    try { navigator.vibrate?.([180, 90, 180]); } catch { /* sin vibración */ }
  }
  const c = contexto();
  if (!c) return;
  c.resume().catch(() => {});
  const ahora = c.currentTime;
  // Parciales de una campana (fundamental + armónicos inarmónicos).
  const parciales = [
    { r: 1, v: 0.32 },
    { r: 2.76, v: 0.12 },
    { r: 5.4, v: 0.05 },
  ];
  [0, 0.3].forEach((t) => {
    parciales.forEach(({ r, v }) => {
      const osc = c.createOscillator();
      const vol = c.createGain();
      osc.type = "sine";
      osc.frequency.value = 1046.5 * r;
      vol.gain.setValueAtTime(0.0001, ahora + t);
      vol.gain.exponentialRampToValueAtTime(v, ahora + t + 0.008);
      vol.gain.exponentialRampToValueAtTime(0.0001, ahora + t + 1.3 / r);
      osc.connect(vol).connect(c.destination);
      osc.start(ahora + t);
      osc.stop(ahora + t + 1.35);
    });
  });
}

/** false si el navegador todavía no deja sonar (falta un toque en la pantalla). */
export function sonidoHabilitado(): boolean {
  const c = contexto();
  return !!c && c.state === "running";
}

/** Intenta habilitar el sonido (llamar dentro de un toque/click). */
export async function habilitarSonido(): Promise<boolean> {
  const c = contexto();
  if (!c) return false;
  await c.resume().catch(() => {});
  return c.state === "running";
}
