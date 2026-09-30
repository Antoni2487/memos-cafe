import { Outlet } from "react-router-dom";
import { AlertCircle, X } from "lucide-react";
import Sidebar from "./sidebar";
import Navbar from "./navbar";
import BottomNav from "./bottomNav";
import PedidosPorConfirmar from "./PedidosPorConfirmar";
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
        <PedidosPorConfirmar />

        {error && (
          <div
            role="alert"
            className="mx-4 mt-3 md:mx-6 flex items-start gap-2.5 rounded-xl border border-peligro/25 bg-peligro-fondo px-4 py-3 text-sm text-peligro"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1">{error}</p>
            <button type="button" onClick={clearError} aria-label="Cerrar aviso" className="-m-1 p-1 rounded-md hover:bg-peligro/10">
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
