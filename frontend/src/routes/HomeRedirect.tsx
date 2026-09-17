import { Navigate } from "react-router-dom";
import authService from "../services/authService";
import { ROLES } from "../utils/constants";

export default function HomeRedirect() {
  const user = authService.getUser();
  if (user.roles.includes(ROLES.ADMIN)) {
    return <Navigate to="/dashboard" replace />;
  }
  // Cocina no puede leer /api/ordenes/ (solo "ordenes_cocina") — /home
  // quedaría degradado para ese rol, así que va directo a su tablero.
  if (user.roles.includes(ROLES.COCINA)) {
    return <Navigate to="/cocina" replace />;
  }
  return <Navigate to="/home" replace />;
}
