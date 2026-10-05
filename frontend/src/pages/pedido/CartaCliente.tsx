import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import FichaProducto, { type ItemCarta } from "./FichaProducto";
import { soles, type PedidoMesa } from "./usePedidoMesa";

interface Seccion {
  id: string;
  titulo: string;
  items: ItemCarta[];
}

const MS_FOTO = 4500;

/** La carta: fotos que van cambiando arriba, categorías y productos. */
export default function CartaCliente({ pedido }: { pedido: PedidoMesa }) {
  const { productos, promociones, cargandoCarta, carrito, agregar, mesaNumero } = pedido;
  const [ficha, setFicha] = useState<ItemCarta | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [activa, setActiva] = useState<string>("");

  const secciones = useMemo<Seccion[]>(() => {
    const lista: Seccion[] = [];
    if (promociones.length) {
      lista.push({
        id: "promociones",
        titulo: "Promociones",
        items: promociones.map((p) => ({
          tipo: "promocion", id: p.id, nombre: p.nombre, descripcion: p.descripcion, precio: p.precio, imagen: p.imagen,
        })),
      });
    }
    const porCategoria = new Map<string, ItemCarta[]>();
    for (const p of productos) {
      const cat = p.categoria_nombre || "Otros";
      if (!porCategoria.has(cat)) porCategoria.set(cat, []);
      porCategoria.get(cat)!.push({
        tipo: "producto", id: p.id, nombre: p.nombre, descripcion: p.descripcion, precio: p.precio, imagen: p.imagen, categoria: cat,
      });
    }
    for (const [cat, items] of porCategoria) lista.push({ id: `cat-${cat}`, titulo: cat, items });
    return lista;
  }, [productos, promociones]);

  const termino = busqueda.trim().toLowerCase();
  const visibles = termino
    ? secciones
        .map((s) => ({
          ...s,
          items: s.items.filter(
            (i) => i.nombre.toLowerCase().includes(termino) || i.descripcion?.toLowerCase().includes(termino)
          ),
        }))
        .filter((s) => s.items.length > 0)
    : secciones;

  const enCarrito = (item: ItemCarta) =>
    carrito.filter((c) => c.tipo === item.tipo && c.id === item.id).reduce((s, c) => s + c.cantidad, 0);

  // Resalta la categoría que se está viendo al hacer scroll.
  const chips = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (termino) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        const visible = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiva(visible.target.id);
      },
      { rootMargin: "-120px 0px -65% 0px" }
    );
    secciones.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [secciones, termino]);

  useEffect(() => {
    chips.current?.querySelector(`[data-seccion="${CSS.escape(activa)}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [activa]);

  const irA = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 70, behavior: "smooth" });
  };

  const fotos = useMemo(
    () => [...promociones, ...productos].map((p) => p.imagen).filter((i): i is string => Boolean(i)).slice(0, 6),
    [productos, promociones]
  );

  return (
    <>
      <Portada fotos={fotos} mesaNumero={mesaNumero} />

      <div className="relative -mt-6 rounded-t-[28px] bg-beige pt-5">
        <div className="px-5">
          <label className="flex h-12 items-center gap-3 rounded-2xl border border-linea bg-marfil px-4 shadow-suave focus-within:border-salvia">
            <Search className="size-4.5 shrink-0 text-tenue" aria-hidden />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              maxLength={60}
            placeholder="¿Qué se te antoja?"
              aria-label="Buscar en la carta"
              className="min-w-0 flex-1 bg-transparent text-base text-espresso placeholder:text-tenue outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {busqueda && (
              <button type="button" onClick={() => setBusqueda("")} aria-label="Borrar búsqueda" className="-mr-1.5 grid size-8 place-items-center rounded-full text-tenue">
                <X className="size-4" />
              </button>
            )}
          </label>
        </div>

        {!termino && secciones.length > 1 && (
          <div className="sticky top-0 z-20 mt-3 bg-beige/95 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
            <div ref={chips} className="flex gap-2 overflow-x-auto px-5 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {secciones.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  data-seccion={s.id}
                  onClick={() => irA(s.id)}
                  className={`shrink-0 rounded-full px-4 h-9 text-sm font-medium transition-colors ${
                    activa === s.id ? "bg-espresso text-marfil" : "border border-linea bg-marfil text-espresso"
                  }`}
                >
                  {s.titulo}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-8 px-5 pb-8 pt-4">
          {cargandoCarta ? (
            <Esqueleto />
          ) : visibles.length === 0 ? (
            <p className="py-12 text-center text-[15px] text-suave">
              {termino ? `No encontramos "${busqueda}" en la carta.` : "La carta no está disponible en este momento."}
            </p>
          ) : (
            visibles.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`${s.id}-titulo`} className="scroll-mt-20">
                <h2 id={`${s.id}-titulo`} className="mb-2 font-display text-[22px] font-semibold text-espresso">
                  {s.titulo}
                </h2>
                <ul className="divide-y divide-linea">
                  {s.items.map((item) => (
                    <li key={`${item.tipo}-${item.id}`}>
                      <FilaProducto
                        item={item}
                        cantidad={enCarrito(item)}
                        onAbrir={() => setFicha(item)}
                        onAgregarRapido={() =>
                          agregar({ tipo: item.tipo, id: item.id, nombre: item.nombre, precio: Number(item.precio), imagen: item.imagen, cantidad: 1, nota: "" })
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>

      {ficha && <FichaProducto item={ficha} onAgregar={agregar} onCerrar={() => setFicha(null)} />}
    </>
  );
}

function FilaProducto({
  item,
  cantidad,
  onAbrir,
  onAgregarRapido,
}: {
  item: ItemCarta;
  cantidad: number;
  onAbrir: () => void;
  onAgregarRapido: () => void;
}) {
  return (
    <div className="relative flex gap-4 py-4">
      <button type="button" onClick={onAbrir} className="flex min-w-0 flex-1 flex-col items-start text-left">
        <span className="text-base font-semibold leading-snug text-espresso">{item.nombre}</span>
        {item.descripcion && (
          <span className="mt-1 line-clamp-2 text-sm leading-snug text-suave">{item.descripcion}</span>
        )}
        <span className="mt-2 text-[15px] font-medium text-espresso tabular-nums">{soles(item.precio)}</span>
      </button>
      <div className="relative shrink-0">
        <button type="button" onClick={onAbrir} tabIndex={-1} aria-hidden className="block">
          {item.imagen ? (
            <img src={item.imagen} alt="" loading="lazy" className="size-24 rounded-2xl object-cover" />
          ) : (
            <span className="grid size-24 place-items-center rounded-2xl bg-salvia-clara font-display text-3xl text-salvia/60">
              {item.nombre.charAt(0)}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onAgregarRapido}
          aria-label={cantidad ? `Agregar otro ${item.nombre} (llevas ${cantidad})` : `Agregar ${item.nombre}`}
          className={`absolute -bottom-2 -right-2 grid h-10 min-w-10 place-items-center rounded-full px-2 text-sm font-semibold shadow-suave ring-3 ring-beige transition-transform active:scale-90 ${
            cantidad ? "bg-salvia text-marfil" : "bg-marfil text-salvia-osc"
          }`}
        >
          {cantidad ? cantidad : <Plus className="size-5" strokeWidth={2.2} />}
        </button>
      </div>
    </div>
  );
}

function Portada({ fotos, mesaNumero }: { fotos: string[]; mesaNumero: number | null }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (fotos.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const iv = setInterval(() => setI((x) => (x + 1) % fotos.length), MS_FOTO);
    return () => clearInterval(iv);
  }, [fotos.length]);

  return (
    <header className="relative h-64 overflow-hidden bg-salvia sm:h-72">
      {fotos.map((src, n) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          className={`absolute inset-0 size-full object-cover transition-[opacity,transform] duration-[1400ms] ease-out ${
            n === i ? "scale-100 opacity-100" : "scale-105 opacity-0"
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-b from-espresso/35 via-espresso/10 to-espresso/65" />
      <div
        className="relative flex h-full flex-col justify-between px-5 pb-10"
        style={{ paddingTop: "max(18px, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center justify-between">
          <img src="/logo-memos.png" alt="Memo's Coffee" className="size-12 rounded-full ring-2 ring-marfil/70" />
          {mesaNumero !== null && (
            <span className="rounded-full bg-marfil/90 px-3.5 py-1.5 text-sm font-semibold text-espresso backdrop-blur">
              Mesa {mesaNumero}
            </span>
          )}
        </div>
        <div className="text-marfil">
          <p className="text-sm font-medium opacity-90">Bienvenido a</p>
          <h1 className="font-display text-[34px] font-semibold leading-none">Memo's Coffee</h1>
          <p className="mt-1.5 text-sm opacity-90">Coffee, postres &amp; champagne</p>
        </div>
      </div>
      {fotos.length > 1 && (
        <div className="absolute bottom-9 right-5 flex gap-1.5" aria-hidden>
          {fotos.map((src, n) => (
            <span key={src} className={`h-1.5 rounded-full bg-marfil transition-all ${n === i ? "w-5" : "w-1.5 opacity-60"}`} />
          ))}
        </div>
      )}
    </header>
  );
}

function Esqueleto() {
  return (
    <div className="flex flex-col gap-4" aria-label="Cargando la carta" role="status">
      <div className="h-7 w-40 animate-pulse rounded-lg bg-arena" />
      {[0, 1, 2, 3].map((n) => (
        <div key={n} className="flex gap-4 py-2">
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-5 w-3/5 animate-pulse rounded bg-arena" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-arena" />
            <div className="h-4 w-16 animate-pulse rounded bg-arena" />
          </div>
          <div className="size-24 animate-pulse rounded-2xl bg-arena" />
        </div>
      ))}
    </div>
  );
}
