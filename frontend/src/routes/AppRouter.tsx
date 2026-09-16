import { BrowserRouter, Routes, Route } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";
import { ROLES } from "../utils/constants";
import Layout from "../components/layout/layout";

// Pages
import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import HomePage from "../pages/home/HomePage";
import HomeRedirect from "./HomeRedirect";
import MesasPage from "../pages/mesas/MesasPage";
import OrdenesPage from "../pages/ordenes/OrdenesPage";
import ComandaPage from "../pages/ordenes/ComandaPage";
import ProductosPage from "../pages/productos/ProductosPage";
import CajaPage from "../pages/caja/CajaPage";
import ReportesPage from "../pages/reportes/ReportesPage";
import InsumosPage from "../pages/insumos/InsumosPage";
import UsuariosPage from "../pages/usuarios/UsuariosPage";
import RolesPage from "../pages/roles/RolesPage";
import CategoriaPage from "../pages/categorias/CategoriaPage";
import PromocionesPage from "../pages/promociones/PromocionesPage";

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pública */}
        <Route path="/login" element={<LoginPage />} />

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
    </BrowserRouter>
  );
}
