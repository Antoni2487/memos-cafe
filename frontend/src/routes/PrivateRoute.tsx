import { Navigate, Outlet } from "react-router-dom";
import authService from "../services/authService";

interface PrivateRouteProps {
  roles?: string[];
  modulo?: string;
}

export default function PrivateRoute({ roles = [], modulo }: PrivateRouteProps) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  if (roles.length > 0) {
    const userRoles: string[] = JSON.parse(localStorage.getItem("user_roles") || "[]");
    const tieneAcceso = roles.some((rol) => userRoles.includes(rol));
    if (!tieneAcceso) {
      return <Navigate to="/" replace />;
    }
  }

  if (modulo && !authService.tieneModulo(modulo)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
