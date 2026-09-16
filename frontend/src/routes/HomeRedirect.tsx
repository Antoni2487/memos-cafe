import { Navigate } from "react-router-dom";
import authService from "../services/authService";
import { ROLES } from "../utils/constants";

export default function HomeRedirect() {
  const user = authService.getUser();
  if (user.roles.includes(ROLES.ADMIN)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/home" replace />;
}
