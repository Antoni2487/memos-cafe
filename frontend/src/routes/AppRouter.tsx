import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";
import HomeRedirect from "./HomeRedirect";
import { ROLES } from "../utils/constants";
import Layout from "../components/layout/layout";
import { LoadingSpinner } from "../components/common";

// Pages
import LoginPage from "../pages/auth/LoginPage";
const DashboardPage = lazy(() => import("../pages/dashboard/DashboardPage"));
const HomePage = lazy(() => import("../pages/home/HomePage"));
const MesasPage = lazy(() => import("../pages/mesas/MesasPage"));
const OrdenesPage = lazy(() => import("../pages/ordenes/OrdenesPage"));
const ComandaPage = lazy(() => import("../pages/ordenes/ComandaPage"));
const ProductosPage = lazy(() => import("../pages/productos/ProductosPage"));
const CajaPage = lazy(() => import("../pages/caja/CajaPage"));
const ReportesPage = lazy(() => import("../pages/reportes/ReportesPage"));
const InsumosPage = lazy(() => import("../pages/insumos/InsumosPage"));
const UsuariosPage = lazy(() => import("../pages/usuarios/UsuariosPage"));
const RolesPage = lazy(() => import("../pages/roles/RolesPage"));
const CategoriaPage = lazy(() => import("../pages/categorias/CategoriaPage"));
const PromocionesPage = lazy(() => import("../pages/promociones/PromocionesPage"));
const CocinaPage = lazy(() => import("../pages/cocina/CocinaPage"));
const PedidoQRPage = lazy(() => import("../pages/pedido/PedidoQRPage"));

export default function AppRouter() {
  return (
    <BrowserRouter>
      {/* Cada pantalla se descarga al abrirla: el celular no baja los
          gráficos de Reportes para abrir Mesas. */}
      <Suspense fallback={<LoadingSpinner full />}>
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<LoginPage />} />
        {/* Pedido por QR del cliente — sin login, sin sidebar/layout de staff */}
        <Route path="/pedir/:codigo" element={<PedidoQRPage />} />

        {
          /* Rutas protegidas dentro del layout común */
        }
        <Route element={<Layout />}> {

        }

          {/* Todos los roles autenticados */}
          <Route element={<PrivateRoute roles={[ROLES.ADMIN]} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>
          <Route element={<PrivateRoute />}>
            <Route path="/home" element={<HomePage />} />
          </Route>

          {/* Mesas y Órdenes: acceso además condicionado por PermisoRol
              (admin controla esto desde "Roles y Permisos"). list/retrieve
              de mesas en el backend sigue abierto porque Órdenes depende
              de leer mesas para el selector, aunque "mesas" esté deshabilitado. */}
          <Route element={<PrivateRoute modulo="mesas" />}>
            <Route path="/mesas" element={<MesasPage />} />
          </Route>
          <Route element={<PrivateRoute modulo="ordenes" />}>
            <Route path="/ordenes" element={<OrdenesPage />} />
            <Route path="/comanda/:ordenId" element={<ComandaPage />} />
          </Route>

          <Route element={<PrivateRoute modulo="ordenes_cocina" />}>
            <Route path="/cocina" element={<CocinaPage />} />
          </Route>

          {/* Solo admin y cajero, y solo si el módulo "caja" está habilitado */}
          <Route element={<PrivateRoute roles={[ROLES.ADMIN, ROLES.CAJERO]} modulo="caja" />}>
            <Route path="/caja" element={<CajaPage />} />
          </Route>

          <Route element={<PrivateRoute roles={[ROLES.ADMIN]} />}>
            <Route path="/productos" element={<ProductosPage />} />
            <Route path="/promociones" element={<PromocionesPage />} />
            <Route path="/reportes" element={<ReportesPage />} />
            <Route path="/insumos" element={<InsumosPage />} />
            <Route path="/usuarios" element={<UsuariosPage />} />
            <Route path="/roles" element={<RolesPage />} />
            <Route path="/categorias" element={<CategoriaPage />} />
          </Route>

        </Route> {/* ← cierra Layout */}

        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
