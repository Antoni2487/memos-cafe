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
