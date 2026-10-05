import { MAX_POR_PRODUCTO } from "./usePedidoMesa";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import Hoja from "./Hoja";
import { precioNum, soles, type EntradaCarrito } from "./usePedidoMesa";

export interface ItemCarta {
  tipo: "producto" | "promocion";
  id: number;
  nombre: string;
  descripcion?: string;
  precio: number | string;
  imagen?: string | null;
  categoria?: string;
}

/** Detalle de un producto: foto grande, descripción, cantidad y nota. */
export default function FichaProducto({
  item,
  onAgregar,
  onCerrar,
}: {
  item: ItemCarta;
  onAgregar: (entrada: EntradaCarrito) => void;
  onCerrar: () => void;
}) {
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const precio = precioNum(item.precio);

  return (
    <Hoja etiqueta={item.nombre} onCerrar={onCerrar} sinRelleno>
      {item.imagen ? (
        <img src={item.imagen} alt="" className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="grid aspect-[5/2] w-full place-items-center bg-salvia-clara">
          <span className="font-display text-5xl text-salvia/60">{item.nombre.charAt(0)}</span>
        </div>
      )}

      <div className="flex flex-col gap-5 px-5 pb-4 pt-5">
        <div>
          {item.tipo === "promocion" && (
            <span className="mb-1.5 inline-block rounded-full bg-champan-claro px-2.5 py-0.5 text-xs font-semibold text-champan">
              Promoción
            </span>
          )}
          <h2 className="font-display text-2xl font-semibold leading-tight text-espresso">{item.nombre}</h2>
          {item.descripcion && <p className="mt-2 text-[15px] leading-relaxed text-suave">{item.descripcion}</p>}
          <p className="mt-3 text-lg font-semibold text-espresso tabular-nums">{soles(precio)}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nota" className="text-sm font-medium text-espresso">
            ¿Algo especial? <span className="font-normal text-tenue">(opcional)</span>
          </label>
          <textarea
            id="nota"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            maxLength={150}
            rows={2}
            placeholder="Ej: sin azúcar, con leche de almendras, bien caliente"
            className="w-full resize-none rounded-2xl border border-linea-fuerte bg-beige px-4 py-3 text-base text-espresso placeholder:text-tenue outline-none focus:border-salvia focus:ring-3 focus:ring-salvia/15"
          />
        </div>
      </div>

      <div
        className="sticky bottom-0 flex items-center gap-3 border-t border-linea bg-marfil px-5 pt-3"
        style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}
      >
        <Contador valor={cantidad} onCambiar={setCantidad} />
        <button
          type="button"
          onClick={() => {
            onAgregar({ tipo: item.tipo, id: item.id, nombre: item.nombre, precio, imagen: item.imagen, cantidad, nota });
            onCerrar();
          }}
          className="flex h-13 flex-1 items-center justify-between gap-3 rounded-2xl bg-salvia px-5 text-[15px] font-semibold text-marfil transition-colors active:bg-salvia-osc"
        >
          <span>Agregar</span>
          <span className="tabular-nums">{soles(precio * cantidad)}</span>
        </button>
      </div>
    </Hoja>
  );
}

export function Contador({
  valor,
  onCambiar,
  min = 1,
  compacto = false,
}: {
  valor: number;
  onCambiar: (v: number) => void;
  min?: number;
  compacto?: boolean;
}) {
  const tam = compacto ? "size-9" : "size-11";
  return (
    <div className="flex items-center rounded-full border border-linea-fuerte bg-beige p-1">
      <button
        type="button"
        onClick={() => onCambiar(Math.max(min, valor - 1))}
        disabled={valor <= min && min > 0}
        aria-label="Quitar uno"
        className={`${tam} grid place-items-center rounded-full text-espresso transition-colors active:bg-arena disabled:opacity-35`}
      >
        <Minus className="size-4" />
      </button>
      <span className="w-7 text-center text-base font-semibold text-espresso tabular-nums" aria-live="polite">
        {valor}
      </span>
      <button
        type="button"
        onClick={() => onCambiar(Math.min(MAX_POR_PRODUCTO, valor + 1))}
        disabled={valor >= MAX_POR_PRODUCTO}
        aria-label="Agregar uno"
        className={`${tam} grid place-items-center rounded-full text-espresso transition-colors active:bg-arena disabled:opacity-35`}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
