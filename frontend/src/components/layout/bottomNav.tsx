import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Table2,
  ClipboardList,
  Receipt,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import authService from "../../services/authService";

interface BottomNavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  roles?: string[];
}

// Solo los ítems principales para el bottom nav móvil (máx 5)
const BOTTOM_ITEMS: BottomNavItem[] = [
  { icon: LayoutDashboard, label: "Inicio",   path: "/dashboard" },
  { icon: Table2,          label: "Mesas",    path: "/mesas"     },
  { icon: ClipboardList,   label: "Órdenes",  path: "/ordenes"   },
  { icon: Receipt,         label: "Caja",     path: "/caja",     roles: ["admin", "cajero"] },
  { icon: MoreHorizontal,  label: "Más",      path: "/mas"       }, // ← opcional: drawer o menú
];

export default function BottomNav() {
  const visibleItems = BOTTOM_ITEMS.filter(({ roles }) => {
    if (!roles) return true;
    return roles.some((role) => authService.hasRole(role));
  });

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch"
      style={{
        backgroundColor: "#2C5545",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        height: 56,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {visibleItems.map(({ icon: Icon, label, path }) => (
        <NavLink
          key={path}
          to={path}
          className="flex flex-col items-center justify-center flex-1 gap-0.5 transition-opacity"
          style={({ isActive }) => ({
            color: isActive ? "white" : "rgba(255,255,255,0.5)",
            textDecoration: "none",
            fontSize: 9.5,
            fontFamily: "'Lato', sans-serif",
            fontWeight: isActive ? 600 : 400,
            letterSpacing: "0.04em",
            minHeight: 44, // tap target mínimo
          })}
        >
          {({ isActive }) => (
            <>
              <div
                style={{
                  width: 32,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  backgroundColor: isActive ? "rgba(255,255,255,0.15)" : "transparent",
                  transition: "background-color 0.2s",
                }}
              >
                <Icon size={18} strokeWidth={isActive ? 2 : 1.8} />
              </div>
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
