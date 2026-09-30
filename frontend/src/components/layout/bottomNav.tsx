import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";
import authService from "../../services/authService";
import { iniciales, itemsVisibles, nombreRol, pestanasMovil, type ItemNav } from "./navegacion";

/**
 * Barra de pestañas del celular, como en una app: los 4 accesos que el rol
 * usa todo el día y "Más" para el resto. Queda al alcance del pulgar y
 * respeta el área segura de los iPhone (la barrita de abajo).
 */
export default function BottomNav() {
  const [masAbierto, setMasAbierto] = useState(false);
  const cerrarMas = useCallback(() => setMasAbierto(false), []);
  const { pathname } = useLocation();
  const { principales, resto } = pestanasMovil(itemsVisibles());
  const enResto = resto.some((i) => pathname === i.path || pathname.startsWith(`${i.path}/`));

  return (
    <>
      <nav
        aria-label="Navegación principal"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-marfil/95 backdrop-blur border-t border-linea"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex h-16 items-stretch px-1">
          {principales.map((item) => (
            <li key={item.path} className="flex-1">
              <Pestana item={item} />
            </li>
          ))}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMasAbierto(true)}
              aria-haspopup="dialog"
              aria-expanded={masAbierto}
              className="w-full h-full"
            >
              <Contenido icon={Menu} label="Más" activo={enResto || masAbierto} />
            </button>
          </li>
        </ul>
      </nav>
      {masAbierto && <HojaMas items={resto} onCerrar={cerrarMas} />}
    </>
  );
}

function Pestana({ item }: { item: ItemNav }) {
  return (
    <NavLink to={item.path} className="block h-full">
      {({ isActive }) => <Contenido icon={item.icon} label={item.label} activo={isActive} />}
    </NavLink>
  );
}

function Contenido({ icon: Icon, label, activo }: { icon: ItemNav["icon"]; label: string; activo: boolean }) {
  return (
    <span className="flex h-full flex-col items-center justify-center gap-1">
      <span
        className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${
          activo ? "bg-salvia-clara text-salvia-osc" : "text-suave"
        }`}
      >
        <Icon className="size-5.5" strokeWidth={activo ? 2.1 : 1.8} aria-hidden />
      </span>
      <span className={`text-[11px] leading-none ${activo ? "font-semibold text-salvia-osc" : "text-suave"}`}>
        {label}
      </span>
    </span>
  );
}

/** Hoja que sube desde abajo con el resto de secciones y la cuenta. */
function HojaMas({ items, onCerrar }: { items: ItemNav[]; onCerrar: () => void }) {
  const user = authService.getUser();
  const cerrarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cerrarRef.current?.focus();
    const alPresionar = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", alPresionar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alPresionar);
      document.body.style.overflow = overflow;
    };
  }, [onCerrar]);

  return (
    <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Más opciones">
      <div className="absolute inset-0 bg-espresso/40 animate-in fade-in-0" onClick={onCerrar} />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-marfil shadow-alta animate-in slide-in-from-bottom duration-200"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-linea-fuerte" aria-hidden />
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          <span className="size-11 shrink-0 rounded-full bg-champan-claro text-champan grid place-items-center text-sm font-semibold">
            {iniciales(user.nombre || user.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-espresso truncate">{user.nombre || user.email}</p>
            <p className="text-sm text-suave truncate">{nombreRol(user.roles)}</p>
          </div>
          <button
            ref={cerrarRef}
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="size-10 grid place-items-center rounded-full bg-arena text-suave"
          >
            <X className="size-5" strokeWidth={1.8} />
          </button>
        </div>

        {items.length > 0 && (
          <ul className="grid grid-cols-3 gap-2 px-4 pt-1">
            {items.map(({ icon: Icon, label, path }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  onClick={onCerrar}
                  className={({ isActive }) =>
                    `flex flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-4 text-center text-[13px] font-medium transition-colors ${
                      isActive
                        ? "border-salvia/30 bg-salvia-clara text-salvia-osc"
                        : "border-linea bg-beige text-espresso active:bg-arena"
                    }`
                  }
                >
                  <Icon className="size-6" strokeWidth={1.7} aria-hidden />
                  <span className="leading-tight">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        )}

        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => authService.logout()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-linea h-12 text-[15px] font-medium text-peligro active:bg-peligro-fondo"
          >
            <LogOut className="size-4.5" strokeWidth={1.8} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
