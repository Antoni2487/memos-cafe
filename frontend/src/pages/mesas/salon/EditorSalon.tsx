import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  Circle, DoorOpen, LayoutTemplate, Minus, Plus, RectangleHorizontal, RotateCcw, RotateCw, Save, Square, Trash2, Type, Undo2,
} from "lucide-react";
import { ConfirmDialog } from "../../../components/common";
import mesasService from "../../../services/mesasService";
import { getErrorMessage } from "../../../utils/errors";
import { Lienzo, Elemento } from "./Lienzo";
import { estiloPieza, letra } from "./geometria";
import { conPosicion } from "./estadoMesa";
import type { ElementoPlano, FormaPlano, GeometriaPlano, MesaPlano, Plano, TipoElementoPlano } from "../../../types";

const PASO = 10; // las piezas se acomodan a una grilla de 10 unidades

interface MesaEditable extends GeometriaPlano { id: number; numero: number; ocupada: boolean }
interface ElementoEditable extends ElementoPlano { clave: string }
type Seleccion = { tipo: "mesa"; id: number } | { tipo: "elemento"; clave: string } | null;

let contador = 0;
const nuevaClave = () => `nuevo-${Date.now()}-${contador++}`;

const ELEMENTO_NUEVO: Record<TipoElementoPlano, Omit<ElementoPlano, "plano_x" | "plano_y">> = {
  barra: { tipo: "barra", etiqueta: "Barra", plano_ancho: 120, plano_alto: 360, forma: "redonda", rotacion: 0 },
  pared: { tipo: "pared", etiqueta: "", plano_ancho: 8, plano_alto: 300, forma: "rectangular", rotacion: 0 },
  entrada: { tipo: "entrada", etiqueta: "Entrada", plano_ancho: 160, plano_alto: 36, forma: "rectangular", rotacion: 0 },
  texto: { tipo: "texto", etiqueta: "Terraza", plano_ancho: 160, plano_alto: 40, forma: "rectangular", rotacion: 0 },
};

function desdePlano(plano: Plano) {
  return {
    mesas: conPosicion(plano.mesas, plano.ancho, plano.alto).map<MesaEditable>((m: MesaPlano) => ({
      id: m.id, numero: m.numero, plano_x: m.plano_x, plano_y: m.plano_y, plano_ancho: m.plano_ancho,
      plano_alto: m.plano_alto, forma: m.forma, rotacion: m.rotacion, ocupada: m.estado === "ocupada",
    })),
    elementos: plano.elementos.map<ElementoEditable>((e) => ({ ...e, clave: e.id ? `e-${e.id}` : nuevaClave() })),
  };
}

/**
 * Editor del croquis (admin). Todo se edita en el navegador y se guarda de
 * una vez; agregar y quitar mesas sí va directo al servidor (las mesas
 * tienen QR y pedidos), pero su lugar en el plano se guarda con el resto.
 */
export default function EditorSalon({ plano, onGuardado, onSalir }: { plano: Plano; onGuardado: (p: Plano) => void; onSalir: () => void }) {
  const inicial = useMemo(() => desdePlano(plano), [plano]);
  const [mesas, setMesas] = useState(inicial.mesas);
  const [elementos, setElementos] = useState(inicial.elementos);
  const [sel, setSel] = useState<Seleccion>(null);
  const [sucio, setSucio] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<null | "plantilla" | "descartar" | "quitar">(null);
  const lienzo = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ x0: number; y0: number; px: number; py: number; escala: number } | null>(null);
  const { ancho, alto } = plano;

  const mesaSel = sel?.tipo === "mesa" ? mesas.find((m) => m.id === sel.id) ?? null : null;
  const elSel = sel?.tipo === "elemento" ? elementos.find((e) => e.clave === sel.clave) ?? null : null;
  const geomSel: GeometriaPlano | null = mesaSel ?? elSel;

  const ajustar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(v / PASO) * PASO));

  type Cambio = Partial<Omit<GeometriaPlano, "plano_x" | "plano_y">> & { plano_x?: number; plano_y?: number; etiqueta?: string };
  const cambiarSel = (cambio: Cambio) => {
    setSucio(true);
    if (sel?.tipo === "mesa") setMesas((ms) => ms.map((m) => (m.id === sel.id ? { ...m, ...cambio } : m)));
    if (sel?.tipo === "elemento") setElementos((es) => es.map((e) => (e.clave === sel.clave ? { ...e, ...cambio } : e)));
  };

  // ── Arrastrar con dedo o mouse ─────────────────────────────────────────
  const empezar = (s: NonNullable<Seleccion>, g: GeometriaPlano) => (e: PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    setSel(s);
    const rect = lienzo.current!.getBoundingClientRect();
    arrastre.current = { x0: e.clientX, y0: e.clientY, px: g.plano_x ?? 0, py: g.plano_y ?? 0, escala: ancho / rect.width };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const mover = (e: PointerEvent<HTMLElement>) => {
    const a = arrastre.current;
    if (!a || !geomSel) return;
    cambiarSel({
      plano_x: ajustar(a.px + (e.clientX - a.x0) * a.escala, 0, ancho),
      plano_y: ajustar(a.py + (e.clientY - a.y0) * a.escala, 0, alto),
    });
  };
  const soltar = () => { arrastre.current = null; };

  // Flechas del teclado mueven la pieza elegida (accesible sin mouse).
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!geomSel || (e.target as HTMLElement).closest("input, textarea")) return;
      const d = { ArrowLeft: [-PASO, 0], ArrowRight: [PASO, 0], ArrowUp: [0, -PASO], ArrowDown: [0, PASO] }[e.key];
      if (!d) return;
      e.preventDefault();
      setSucio(true);
      const nuevo = { plano_x: ajustar((geomSel.plano_x ?? 0) + d[0], 0, ancho), plano_y: ajustar((geomSel.plano_y ?? 0) + d[1], 0, alto) };
      if (sel?.tipo === "mesa") setMesas((ms) => ms.map((m) => (m.id === sel.id ? { ...m, ...nuevo } : m)));
      if (sel?.tipo === "elemento") setElementos((es) => es.map((x) => (x.clave === sel.clave ? { ...x, ...nuevo } : x)));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  // ── Acciones ───────────────────────────────────────────────────────────
  const agregarMesa = async () => {
    setError(null);
    const usados = new Set(mesas.map((m) => m.numero));
    let numero = plano.siguiente_numero;
    while (usados.has(numero)) numero += 1;
    try {
      const { data } = await mesasService.crear({
        numero, capacidad: 4, plano_x: ancho / 2, plano_y: alto / 2, plano_ancho: 80, plano_alto: 80, forma: "redonda", rotacion: 0,
      });
      setMesas((ms) => [...ms, {
        id: data.id, numero: data.numero, plano_x: ancho / 2, plano_y: alto / 2, plano_ancho: 80, plano_alto: 80, forma: "redonda", rotacion: 0, ocupada: false,
      }]);
      setSel({ tipo: "mesa", id: data.id });
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo agregar la mesa"));
    }
  };

  const quitarSeleccion = async () => {
    setConfirmar(null);
    if (sel?.tipo === "elemento") {
      setElementos((es) => es.filter((e) => e.clave !== sel.clave));
      setSucio(true);
      setSel(null);
      return;
    }
    if (!mesaSel) return;
    try {
      await mesasService.darDeBaja(mesaSel.id);
      setMesas((ms) => ms.filter((m) => m.id !== mesaSel.id));
      setSel(null);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo quitar la mesa"));
    }
  };

  const agregarElemento = (tipo: TipoElementoPlano) => {
    const clave = nuevaClave();
    setElementos((es) => [...es, { ...ELEMENTO_NUEVO[tipo], plano_x: ancho / 2, plano_y: alto / 2, clave }]);
    setSel({ tipo: "elemento", clave });
    setSucio(true);
  };

  const usarPlantilla = () => {
    setConfirmar(null);
    // El croquis de Memo's: barra ovalada a la izquierda, una división y las
    // mesas en tres columnas. Después se ajusta a mano.
    const lugares: Partial<GeometriaPlano>[] = [
      ...[110, 250, 390, 530].map((y) => ({ plano_x: 320, plano_y: y, forma: "rectangular" as FormaPlano, plano_ancho: 100, plano_alto: 70 })),
      ...[160, 320, 480].map((y) => ({ plano_x: 520, plano_y: y, forma: "redonda" as FormaPlano, plano_ancho: 90, plano_alto: 90 })),
      ...[160, 320, 480].map((y) => ({ plano_x: 720, plano_y: y, forma: "redonda" as FormaPlano, plano_ancho: 90, plano_alto: 90 })),
    ];
    const ordenadas = [...mesas].sort((a, b) => a.numero - b.numero);
    const ubicadas = ordenadas.map((m, i) => (lugares[i] ? { ...m, rotacion: 0, ...lugares[i] } : { ...m, plano_x: null, plano_y: null }));
    setMesas(conPosicion(ubicadas, ancho, alto));
    setElementos([
      { tipo: "barra", etiqueta: "Barra", plano_x: 100, plano_y: 320, plano_ancho: 120, plano_alto: 460, forma: "redonda", rotacion: 0, clave: nuevaClave() },
      { tipo: "pared", etiqueta: "", plano_x: 220, plano_y: 320, plano_ancho: 8, plano_alto: 540, forma: "rectangular", rotacion: 0, clave: nuevaClave() },
      { tipo: "entrada", etiqueta: "Entrada", plano_x: 880, plano_y: 610, plano_ancho: 160, plano_alto: 36, forma: "rectangular", rotacion: 0, clave: nuevaClave() },
    ]);
    setSel(null);
    setSucio(true);
  };

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      const { data } = await mesasService.guardarPlano({
        mesas: mesas.map(({ id, plano_x, plano_y, plano_ancho, plano_alto, forma, rotacion }) => ({
          id, plano_x: Math.round(plano_x ?? 0), plano_y: Math.round(plano_y ?? 0), plano_ancho, plano_alto, forma, rotacion,
        })),
        elementos: elementos.map((e) => ({
          id: e.id ?? null, tipo: e.tipo, etiqueta: e.etiqueta, forma: e.forma, rotacion: e.rotacion,
          plano_ancho: e.plano_ancho, plano_alto: e.plano_alto, plano_x: Math.round(e.plano_x), plano_y: Math.round(e.plano_y),
        })),
      });
      setSucio(false);
      onGuardado(data);
    } catch (err) {
      setError(getErrorMessage(err, "No se pudo guardar el salón"));
    } finally {
      setGuardando(false);
    }
  };

  // ── Vista ──────────────────────────────────────────────────────────────
  const herramienta = "flex h-10 items-center gap-1.5 rounded-xl border border-linea bg-marfil px-3 text-sm font-medium text-espresso hover:bg-arena disabled:opacity-50";
  const esMesa = sel?.tipo === "mesa";
  const minimo = esMesa ? 50 : elSel?.tipo === "pared" ? 4 : 20;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={agregarMesa} className={`${herramienta} border-salvia/40 text-salvia-osc`}>
          <Plus className="size-4" /> Mesa
        </button>
        <button type="button" onClick={() => agregarElemento("barra")} className={herramienta}><Circle className="size-4" /> Barra</button>
        <button type="button" onClick={() => agregarElemento("pared")} className={herramienta}><Minus className="size-4 rotate-90" /> Pared</button>
        <button type="button" onClick={() => agregarElemento("entrada")} className={herramienta}><DoorOpen className="size-4" /> Entrada</button>
        <button type="button" onClick={() => agregarElemento("texto")} className={herramienta}><Type className="size-4" /> Texto</button>
        <button type="button" onClick={() => setConfirmar("plantilla")} className={herramienta}><LayoutTemplate className="size-4" /> Plantilla</button>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => (sucio ? setConfirmar("descartar") : onSalir())} className={herramienta}>
            <Undo2 className="size-4" /> {sucio ? "Descartar" : "Salir"}
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !sucio}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-salvia px-4 text-sm font-semibold text-marfil hover:bg-salvia-osc disabled:opacity-50"
          >
            <Save className="size-4" /> {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-peligro-fondo px-4 py-2.5 text-sm text-peligro">{error}</p>}
      <p className="text-sm text-suave">
        Arrastra las piezas para acomodarlas. Toca una para cambiar su forma, tamaño o girarla. Los cambios se guardan con "Guardar".
      </p>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1" onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}>
          <Lienzo ref={lienzo} ancho={ancho} alto={alto} cuadricula onPointerDown={() => setSel(null)}>
            {elementos.map((el) => (
              <Elemento
                key={el.clave}
                el={el}
                ancho={ancho}
                alto={alto}
                seleccionado={sel?.tipo === "elemento" && sel.clave === el.clave}
                onPointerDown={empezar({ tipo: "elemento", clave: el.clave }, el)}
              />
            ))}
            {mesas.map((m) => {
              const elegida = sel?.tipo === "mesa" && sel.id === m.id;
              return (
                <div
                  key={m.id}
                  style={estiloPieza(m, ancho, alto)}
                  onPointerDown={empezar({ tipo: "mesa", id: m.id }, m)}
                  role="button"
                  aria-label={`Mesa ${m.numero}`}
                  aria-pressed={elegida}
                  className={`grid cursor-grab place-items-center border-2 bg-salvia-clara text-salvia-osc shadow-suave active:cursor-grabbing ${
                    m.forma === "redonda" ? "rounded-full" : "rounded-[22%]"
                  } ${elegida ? "border-salvia ring-3 ring-salvia/40" : "border-salvia/40"}`}
                >
                  <span className="font-display font-semibold" style={{ fontSize: letra(26, 12), transform: m.rotacion ? `rotate(${-m.rotacion}deg)` : undefined }}>
                    {m.numero}
                  </span>
                </div>
              );
            })}
          </Lienzo>
        </div>

        {/* Propiedades de la pieza elegida */}
        <aside className="rounded-2xl border border-linea bg-marfil p-4 xl:w-72 xl:shrink-0">
          {!geomSel ? (
            <p className="text-sm text-tenue">Toca una mesa o un elemento del plano para editarlo.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <p className="font-display text-lg font-semibold text-espresso">
                {mesaSel ? `Mesa ${mesaSel.numero}` : { barra: "Barra", pared: "Pared o división", entrada: "Entrada", texto: "Texto" }[elSel!.tipo]}
              </p>

              {elSel && elSel.tipo !== "pared" && (
                <label className="flex flex-col gap-1.5 text-sm font-medium text-espresso">
                  Texto
                  <input
                    value={elSel.etiqueta}
                    maxLength={40}
                    onChange={(e) => cambiarSel({ etiqueta: e.target.value })}
                    className="h-10 rounded-xl border border-linea-fuerte bg-beige px-3 text-base font-normal outline-none focus:border-salvia sm:text-sm"
                  />
                </label>
              )}

              {elSel?.tipo !== "pared" && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-espresso">Forma</span>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-arena p-1">
                    {([["redonda", "Redonda", Circle], ["rectangular", mesaSel ? "Cuadrada" : "Rectangular", mesaSel ? Square : RectangleHorizontal]] as const).map(([f, label, Icono]) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => cambiarSel({ forma: f })}
                        className={`flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm ${geomSel.forma === f ? "bg-marfil font-semibold text-espresso shadow-suave" : "text-suave"}`}
                      >
                        <Icono className="size-4" /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(["plano_ancho", "plano_alto"] as const).map((campo) => (
                <label key={campo} className="flex flex-col gap-1.5 text-sm font-medium text-espresso">
                  <span className="flex justify-between">{campo === "plano_ancho" ? "Ancho" : "Alto"} <span className="font-normal text-tenue tabular-nums">{geomSel[campo]}</span></span>
                  <input
                    type="range"
                    min={minimo}
                    max={esMesa ? 240 : campo === "plano_ancho" ? ancho : alto}
                    step={elSel?.tipo === "pared" ? 2 : PASO}
                    value={geomSel[campo]}
                    onChange={(e) => cambiarSel({ [campo]: Number(e.target.value) })}
                    className="accent-[var(--salvia)]"
                  />
                </label>
              ))}

              <div className="flex flex-col gap-1.5">
                <span className="flex justify-between text-sm font-medium text-espresso">Girar <span className="font-normal text-tenue tabular-nums">{geomSel.rotacion}°</span></span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => cambiarSel({ rotacion: (geomSel.rotacion + 345) % 360 })} className={herramienta} aria-label="Girar a la izquierda"><RotateCcw className="size-4" /></button>
                  <button type="button" onClick={() => cambiarSel({ rotacion: (geomSel.rotacion + 15) % 360 })} className={herramienta} aria-label="Girar a la derecha"><RotateCw className="size-4" /></button>
                  <button type="button" onClick={() => cambiarSel({ rotacion: (geomSel.rotacion + 90) % 360 })} className={herramienta}>90°</button>
                  <button type="button" onClick={() => cambiarSel({ rotacion: 0 })} className={herramienta}>0°</button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmar("quitar")}
                disabled={!!mesaSel?.ocupada}
                title={mesaSel?.ocupada ? "No se puede quitar una mesa ocupada" : undefined}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-peligro/30 text-sm font-semibold text-peligro hover:bg-peligro-fondo disabled:opacity-50"
              >
                <Trash2 className="size-4" /> {mesaSel ? "Quitar mesa" : "Quitar"}
              </button>
              {mesaSel?.ocupada && <p className="-mt-2 text-xs text-tenue">Está ocupada: se puede quitar cuando se libere.</p>}
            </div>
          )}
        </aside>
      </div>

      <ConfirmDialog
        abierto={confirmar === "plantilla"}
        titulo="¿Usar la plantilla?"
        descripcion="Acomoda la barra, la división y las mesas según el croquis base. Reemplaza lo que hay en el plano (no se guarda hasta que toques Guardar)."
        textoOk="Usar plantilla"
        variante="primary"
        onConfirmar={usarPlantilla}
        onCancelar={() => setConfirmar(null)}
      />
      <ConfirmDialog
        abierto={confirmar === "descartar"}
        titulo="¿Descartar los cambios?"
        descripcion="El plano vuelve a como estaba la última vez que se guardó."
        textoOk="Descartar"
        onConfirmar={() => { setConfirmar(null); onSalir(); }}
        onCancelar={() => setConfirmar(null)}
      />
      <ConfirmDialog
        abierto={confirmar === "quitar"}
        titulo={mesaSel ? `¿Quitar la mesa ${mesaSel.numero}?` : "¿Quitar este elemento?"}
        descripcion={mesaSel ? "Deja de aparecer en el salón y su QR deja de funcionar. Si después agregas una mesa con el mismo número, vuelve con su mismo QR." : "Se quita del plano al guardar."}
        textoOk="Quitar"
        onConfirmar={quitarSeleccion}
        onCancelar={() => setConfirmar(null)}
      />
    </div>
  );
}
