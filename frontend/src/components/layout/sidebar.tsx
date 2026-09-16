import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Table2,
  ClipboardList,
  Receipt,
  Package,
  BarChart3,
  Boxes,
  Users,
  ShieldCheck,
  Tag,
  LogOut,
  X,
  type LucideIcon,
} from "lucide-react";
import authService from "../../services/authService";

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  roles: string[] | null;
  modulo: string | null;
}

const getNavItems = (userRoles: string[]): NavItem[] => [
  { icon: LayoutDashboard, label: "Panel", path: userRoles.includes("admin") ? "/dashboard" : "/home", roles: null, modulo: null },
  { icon: Table2, label: "Mesas", path: "/mesas", roles: null, modulo: "mesas" },
  { icon: ClipboardList, label: "Órdenes", path: "/ordenes", roles: null, modulo: "ordenes" },
  { icon: Receipt, label: "Caja", path: "/caja", roles: ["admin", "cajero"], modulo: "caja" },
  { icon: Package, label: "Productos", path: "/productos", roles: ["admin"], modulo: null },
  { icon: Tag, label: "Promociones", path: "/promociones", roles: ["admin"], modulo: null },
  { icon: Tag, label: "Categorias", path: "/categorias", roles: ["admin"], modulo: null },
  { icon: Boxes, label: "Insumos", path: "/insumos", roles: ["admin"], modulo: null },
  { icon: BarChart3, label: "Reportes", path: "/reportes", roles: ["admin"], modulo: null },
  { icon: Users, label: "Usuarios", path: "/usuarios", roles: ["admin"], modulo: null },
  { icon: ShieldCheck, label: "Roles y Permisos", path: "/roles", roles: ["admin"], modulo: null },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  const navigate = useNavigate();
  const user = authService.getUser();

  const visibleItems = getNavItems(user.roles).filter(({ roles, modulo }) => {
    if (roles && !roles.some((role) => authService.hasRole(role))) return false;
    if (modulo && !authService.tieneModulo(modulo)) return false;
    return true;
  });

  const handleLogout = () => {
    authService.logout();
    navigate("/login");
  };

  const initials = user.nombre
    ? user.nombre.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
    : "U";

  return (
    <aside
      className={`
        flex flex-col h-full shrink-0 fixed md:static inset-y-0 left-0 z-50
        transition-transform duration-200 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
      `}
      style={{ backgroundColor: "#2C5545", width: "220px" }}
    >
      {/* Logo + cerrar (móvil) */}
      <div
        className="flex flex-col items-center py-7 px-5 border-b relative"
        style={{ borderColor: "rgba(255,255,255,0.12)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 md:hidden"
          style={{ color: "rgba(255,255,255,0.7)" }}
        >
          <X size={20} />
        </button>
        <img
          src="/logomemos.png"
          alt="Memo's Café"
          style={{
            width: 150,
            objectFit: "contain",
          }}
        />
      </div>
      {/* Navegación */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-0.5 overflow-y-auto">
        {visibleItems.map(({ icon: Icon, label, path }) => (
          <NavLink
            key={path}
            to={path}
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left transition-colors"
            style={({ isActive }) => ({
              backgroundColor: isActive ? "#1E4A37" : "transparent",
              color: "white",
              fontFamily: "'Lato', sans-serif",
              fontSize: "13.5px",
              fontWeight: isActive ? 500 : 400,
              opacity: isActive ? 1 : 0.82,
              textDecoration: "none",
            })}
          >
            <Icon size={17} strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Usuario + Logout */}
      <div className="px-4 py-5 border-t" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
        <div className="flex items-center gap-2.5 mb-3">
          <div
            className="rounded-full flex items-center justify-center text-white shrink-0"
            style={{ width: 34, height: 34, backgroundColor: "#1E4A37", fontFamily: "'Lato', sans-serif", fontSize: 13, fontWeight: 600 }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-white truncate" style={{ fontFamily: "'Lato', sans-serif", fontSize: 12.5, fontWeight: 500 }}>
              {user.nombre || user.email}
            </p>
            <p className="truncate" style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
              {user.roles?.[0] || "Usuario"}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full rounded-lg px-3 py-2 transition-colors"
          style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.75)", fontFamily: "'Lato', sans-serif", fontSize: 12.5 }}
        >
          <LogOut size={14} strokeWidth={1.8} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
