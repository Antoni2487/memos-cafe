import { Outlet } from "react-router-dom";
import { AlertCircle, X } from "lucide-react";
import Sidebar from "./sidebar";
import Navbar from "./navbar";
import BottomNav from "./bottomNav";
import PedidosPorConfirmar from "./PedidosPorConfirmar";
import ListosParaServir from "./ListosParaServir";
import useApiErrors from "../../hooks/useApiErrors";

/**
 * Estructura del personal:
 * - Computadora: menú lateral completo + barra superior.
 * - Tablet: menú lateral de solo íconos (más espacio para el contenido).
 * - Celular: barra superior compacta + pestañas abajo, como una app.
 */
export default function Layout() {
  const { error, clearError } = useApiErrors();

  return (
    <div className="flex h-dvh overflow-hidden bg-beige">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Navbar />
        <ListosParaServir />
        <PedidosPorConfirmar />

        {/* Aviso flotante de errores de la API (sin permiso, servidor caído,
            sin conexión): va por encima de todo, también de las ventanas
            abiertas, para que se vea justo después de la acción que falló. */}
        {error && (
          <div
            role="alert"
            className="notif-entrar fixed inset-x-3 z-[70] mx-auto flex max-w-md items-start gap-2.5 rounded-2xl bg-espresso px-4 py-3.5 text-sm font-medium text-marfil shadow-alta"
            style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-peligro-fondo" />
            <p className="flex-1">{error}</p>
            <button type="button" onClick={clearError} aria-label="Cerrar aviso" className="-m-1 rounded-md p-1 text-marfil/80 hover:bg-marfil/10 hover:text-marfil">
              <X className="size-4" />
            </button>
          </div>
        )}

        <main
          className="relative flex-1 overflow-y-auto overscroll-contain"
          style={{ paddingBottom: "var(--barra-inferior)" }}
        >
          <div className="mx-auto w-full max-w-[1400px] p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
