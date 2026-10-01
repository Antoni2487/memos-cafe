import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import authService from "../../services/authService";
import { GRUPOS, iniciales, itemsVisibles, nombreRol } from "./navegacion";
import { useListosParaServir } from "../../hooks/listosParaServir";

export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <img
        src="/logo-memos.png"
        alt="Memo's Coffee"
        width={38}
        height={38}
        className="size-9.5 shrink-0 rounded-full"
      />
      {!compacta && (
        <div className="min-w-0 leading-tight">
          <p className="font-display text-[17px] font-semibold text-espresso truncate">Memo's Coffee</p>
          <p className="text-[11.5px] text-suave truncate">Coffee, postres &amp; champagne</p>
        </div>
      )}
    </div>
  );
}

/**
 * Menú lateral claro. En computadora se ve completo; en tablet (md) se
 * reduce a una columna de íconos para dejarle espacio al contenido. En el
 * celular no se muestra: ahí manda la barra inferior (ver bottomNav).
 */
export default function Sidebar() {
  const user = authService.getUser();
  const porServir = useListosParaServir().length;
  const visibles = itemsVisibles();
  const grupos = GRUPOS.map((grupo) => ({
    grupo,
    items: visibles.filter((i) => i.grupo === grupo),
  })).filter((g) => g.items.length > 0);
  const mostrarTitulos = grupos.length > 1;

  return (
    <aside
      aria-label="Menú principal"
      className="hidden md:flex flex-col shrink-0 h-full bg-arena border-r border-linea md:w-19 lg:w-58 transition-[width]"
    >
      <div className="flex items-center justify-center lg:justify-start px-3 lg:px-4 h-16 shrink-0">
        <span className="lg:hidden"><Marca compacta /></span>
        <span className="hidden lg:block min-w-0"><Marca /></span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 lg:px-3 pt-2 pb-4 flex flex-col gap-5">
        {grupos.map(({ grupo, items }) => (
          <div key={grupo} className="flex flex-col gap-0.5">
            {mostrarTitulos && (
              <p className="hidden lg:block px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-suave">
                {grupo}
              </p>
            )}
            {items.map(({ icon: Icon, label, path }) => (
              <NavLink
                key={path}
                to={path}
                title={label}
                className={({ isActive }) =>
                  [
                    "group flex items-center gap-2.5 rounded-lg text-[13.5px] font-medium transition-colors",
                    "justify-center lg:justify-start h-11 lg:h-9.5 px-0 lg:px-2.5",
                    "focus-visible:outline-2 focus-visible:outline-salvia",
                    isActive
                      ? "bg-salvia-clara text-salvia-osc font-semibold"
                      : "text-suave hover:bg-marfil/70 hover:text-espresso",
                  ].join(" ")
                }
              >
                <span className="relative">
                  <Icon className="size-4.5 shrink-0" strokeWidth={1.8} aria-hidden />
                  {path === "/mesas" && porServir > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 size-2.5 rounded-full bg-peligro ring-2 ring-arena lg:hidden" aria-hidden />
                  )}
                </span>
                <span className="hidden lg:inline truncate">{label}</span>
                {path === "/mesas" && porServir > 0 && (
                  <span className="ml-auto hidden h-5 min-w-5 place-items-center rounded-full bg-peligro px-1.5 text-[11px] font-bold text-marfil lg:grid">
                    {porServir}
                  </span>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="p-2.5 lg:p-3 border-t border-linea">
        <div className="flex items-center gap-2.5 rounded-xl lg:bg-marfil lg:border lg:border-linea p-1.5 lg:p-2 justify-center lg:justify-start">
          <span
            className="size-8 shrink-0 rounded-full bg-champan-claro text-champan grid place-items-center text-xs font-semibold"
            title={user.nombre || user.email}
          >
            {iniciales(user.nombre || user.email)}
          </span>
          <div className="hidden lg:block min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-espresso truncate">{user.nombre || user.email}</p>
            <p className="text-xs text-suave truncate">{nombreRol(user.roles)}</p>
          </div>
          <button
            type="button"
            onClick={() => authService.logout()}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="hidden lg:grid size-8 place-items-center rounded-lg text-suave hover:bg-arena hover:text-peligro transition-colors"
          >
            <LogOut className="size-4" strokeWidth={1.8} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => authService.logout()}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
          className="lg:hidden mt-1 w-full h-10 grid place-items-center rounded-lg text-suave hover:bg-marfil hover:text-peligro transition-colors"
        >
          <LogOut className="size-4" strokeWidth={1.8} />
        </button>
      </div>
    </aside>
  );
}
