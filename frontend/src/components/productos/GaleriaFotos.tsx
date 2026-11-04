import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Camera, Check, Star, Trash2 } from "lucide-react";
import productoService from "../../services/productoService";
import { getErrorMessage } from "../../utils/errors";
import { MAX_FOTOS } from "../../utils/galeria";
import type { Producto } from "../../types";

const MAX_MB = 5;
const MS_RECIEN_SUBIDA = 1600;

interface Subida {
  clave: string;
  preview: string;
  progreso: number;
}

/** Una miniatura de la galería: la portada o una foto adicional. */
interface Miniatura {
  clave: string;
  src: string;
  fotoId: number | null; // null = portada
}

/**
 * Galería del producto en el formulario de edición: subir varias fotos (con
 * barra de progreso), elegir la portada, ordenarlas arrastrando o con las
 * flechas, y quitarlas. Cada cambio se guarda al momento en el servidor; la
 * primera foto es la que se ve en el carrito y en la tabla.
 */
export default function GaleriaFotos({
  producto,
  onCambio,
}: {
  producto: Producto;
  onCambio?: (producto: Producto) => void;
}) {
  const [actual, setActual] = useState(producto);
  const [subidas, setSubidas] = useState<Subida[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recienSubida, setRecienSubida] = useState<number | null>(null);
  const [arrastrada, setArrastrada] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Si el modal pasa a otro producto, la galería arranca de nuevo.
  const [productoId, setProductoId] = useState(producto.id);
  if (productoId !== producto.id) {
    setProductoId(producto.id);
    setActual(producto);
    setSubidas([]);
    setError(null);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const miniaturas: Miniatura[] = [
    ...(actual.imagen ? [{ clave: "portada", src: actual.imagen, fotoId: null }] : []),
    ...(actual.fotos ?? []).map((f) => ({ clave: `foto-${f.id}`, src: f.imagen, fotoId: f.id })),
  ];
  const lugares = MAX_FOTOS - miniaturas.length - subidas.length;

  const aplicar = (p: Producto) => {
    setActual(p);
    onCambio?.(p);
  };

  const ejecutar = async (accion: () => Promise<{ data: Producto }>, mensaje: string) => {
    setOcupado(true);
    setError(null);
    try {
      aplicar((await accion()).data);
    } catch (err) {
      setError(getErrorMessage(err, mensaje));
    } finally {
      setOcupado(false);
    }
  };

  const subir = async (archivos: File[]) => {
    const validos = archivos.filter((f) => f.type.startsWith("image/") && f.size <= MAX_MB * 1024 * 1024);
    if (validos.length < archivos.length) setError(`Solo imágenes de hasta ${MAX_MB}MB.`);
    const lote = validos.slice(0, Math.max(0, lugares));
    if (validos.length > lote.length) setError(`Cada producto admite hasta ${MAX_FOTOS} fotos.`);
    if (!lote.length) return;

    const nuevas = lote.map((f) => ({ clave: crypto.randomUUID(), preview: URL.createObjectURL(f), progreso: 0 }));
    setSubidas((prev) => [...prev, ...nuevas]);

    // De a una: el servidor numera las fotos en el orden en que llegan.
    let ultimo = actual;
    for (const [n, archivo] of lote.entries()) {
      const { clave, preview } = nuevas[n];
      try {
        const antes = new Set((ultimo.fotos ?? []).map((f) => f.id));
        const { data } = await productoService.subirFoto(ultimo.id, archivo, (progreso) =>
          setSubidas((prev) => prev.map((s) => (s.clave === clave ? { ...s, progreso } : s)))
        );
        ultimo = data;
        aplicar(data);
        const nueva = (data.fotos ?? []).find((f) => !antes.has(f.id));
        setRecienSubida(nueva?.id ?? null);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setRecienSubida(null), MS_RECIEN_SUBIDA);
      } catch (err) {
        setError(getErrorMessage(err, "No se pudo subir la foto."));
      } finally {
        URL.revokeObjectURL(preview);
        setSubidas((prev) => prev.filter((s) => s.clave !== clave));
      }
    }
  };

  const alElegir = (e: ChangeEvent<HTMLInputElement>) => {
    subir(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  const ordenar = (desde: number, hasta: number) => {
    const fotos = [...(actual.fotos ?? [])];
    const [movida] = fotos.splice(desde, 1);
    fotos.splice(hasta, 0, movida);
    // Optimista: se ve al instante y, si falla, vuelve lo del servidor.
    setActual({ ...actual, fotos });
    ejecutar(() => productoService.ordenarFotos(actual.id, fotos.map((f) => f.id)), "No se pudo ordenar.");
  };

  const alSoltar = (destino: Miniatura) => (e: DragEvent) => {
    e.preventDefault();
    const fotoId = arrastrada;
    setArrastrada(null);
    if (fotoId === null || fotoId === destino.fotoId) return;
    if (destino.fotoId === null) {
      ejecutar(() => productoService.hacerPortada(actual.id, fotoId), "No se pudo cambiar la portada.");
      return;
    }
    const fotos = actual.fotos ?? [];
    ordenar(fotos.findIndex((f) => f.id === fotoId), fotos.findIndex((f) => f.id === destino.fotoId));
  };

  const totalFotos = (actual.fotos ?? []).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-suave">Fotos del producto</span>
        <span className="text-xs text-tenue tabular-nums" aria-live="polite">
          {subidas.length ? "Subiendo…" : `${miniaturas.length} / ${MAX_FOTOS}`}
        </span>
      </div>

      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6" aria-label="Fotos del producto">
        {miniaturas.map((m, n) => {
          const indice = n - (actual.imagen ? 1 : 0); // posición dentro de `fotos`
          return (
            <li
              key={m.clave}
              draggable={m.fotoId !== null && !ocupado}
              onDragStart={() => setArrastrada(m.fotoId)}
              onDragEnd={() => setArrastrada(null)}
              onDragOver={(e) => arrastrada !== null && e.preventDefault()}
              onDrop={alSoltar(m)}
              className={`group relative aspect-square overflow-hidden rounded-xl border bg-arena transition-[transform,opacity,box-shadow] duration-200 ease-out animate-in fade-in-0 zoom-in-95 ${
                arrastrada === m.fotoId ? "scale-95 opacity-50" : ""
              } ${arrastrada !== null && arrastrada !== m.fotoId ? "border-salvia" : "border-linea"} ${
                m.fotoId !== null ? "cursor-grab active:cursor-grabbing" : ""
              }`}
            >
              <img src={m.src} alt="" className="size-full object-cover" draggable={false} />
              {m.fotoId === null && (
                <span className="absolute bottom-1 left-1 rounded-md bg-espresso/85 px-1.5 py-0.5 text-[10px] font-semibold text-marfil">
                  Portada
                </span>
              )}
              {m.fotoId !== null && m.fotoId === recienSubida && (
                <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-salvia text-marfil animate-in zoom-in-50 duration-300">
                  <Check className="size-3" strokeWidth={3} />
                </span>
              )}
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-espresso/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
                {m.fotoId !== null && indice > 0 && (
                  <BotonFoto etiqueta="Mover antes" disabled={ocupado} onClick={() => ordenar(indice, indice - 1)}>
                    <ArrowLeft className="size-3.5" />
                  </BotonFoto>
                )}
                {m.fotoId !== null && (
                  <BotonFoto
                    etiqueta="Usar como portada"
                    disabled={ocupado}
                    onClick={() => ejecutar(() => productoService.hacerPortada(actual.id, m.fotoId!), "No se pudo cambiar la portada.")}
                  >
                    <Star className="size-3.5" />
                  </BotonFoto>
                )}
                <BotonFoto
                  etiqueta="Quitar foto"
                  peligro
                  disabled={ocupado}
                  onClick={() =>
                    ejecutar(
                      () => (m.fotoId === null ? productoService.quitarPortada(actual.id) : productoService.eliminarFoto(actual.id, m.fotoId)),
                      "No se pudo quitar la foto."
                    )
                  }
                >
                  <Trash2 className="size-3.5" />
                </BotonFoto>
                {m.fotoId !== null && indice < totalFotos - 1 && (
                  <BotonFoto etiqueta="Mover después" disabled={ocupado} onClick={() => ordenar(indice, indice + 1)}>
                    <ArrowRight className="size-3.5" />
                  </BotonFoto>
                )}
              </div>
            </li>
          );
        })}

        {subidas.map((s) => (
          <li key={s.clave} className="relative aspect-square overflow-hidden rounded-xl border border-linea animate-in fade-in-0 zoom-in-95">
            <img src={s.preview} alt="" className="size-full object-cover" />
            <div className="absolute inset-0 bg-espresso/45" />
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[11px] font-bold text-marfil tabular-nums">
              {s.progreso}%
            </span>
            <span className="absolute inset-x-2 bottom-2 h-1 overflow-hidden rounded-full bg-marfil/40">
              <span
                className="block h-full rounded-full bg-marfil transition-[width] duration-300 ease-out"
                style={{ width: `${s.progreso}%` }}
                role="progressbar"
                aria-valuenow={s.progreso}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Subiendo foto"
              />
            </span>
          </li>
        ))}

        {lugares > 0 && (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={ocupado}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed border-salvia bg-salvia-clara/50 text-salvia transition-colors hover:bg-salvia-clara disabled:opacity-50"
            >
              <Camera className="size-5" strokeWidth={1.8} />
              <span className="text-[11px] font-semibold">Agregar</span>
            </button>
          </li>
        )}
      </ul>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={alElegir} className="hidden" />

      <p className="text-xs text-tenue">
        Arrastra una foto para ordenarla o súltala sobre la portada para reemplazarla. La primera es la que se ve en la carta.
      </p>
      {error && (
        <p role="alert" className="text-xs text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}

function BotonFoto({
  etiqueta, onClick, disabled, peligro = false, children,
}: {
  etiqueta: string;
  onClick: () => void;
  disabled?: boolean;
  peligro?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      title={etiqueta}
      className={`grid size-7 place-items-center rounded-md bg-marfil shadow-suave transition-transform active:scale-90 disabled:opacity-50 ${
        peligro ? "text-peligro" : "text-salvia"
      }`}
    >
      {children}
    </button>
  );
}
