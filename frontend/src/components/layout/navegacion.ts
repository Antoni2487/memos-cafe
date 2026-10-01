import {
  BarChart3,
  Boxes,
  ChefHat,
  ClipboardList,
  House,
  LayoutDashboard,
  Package,
  Receipt,
  ShieldCheck,
  Table2,
  Tag,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import authService from "../../services/authService";
import { ROLES } from "../../utils/constants";

// Única fuente de verdad de la navegación: la usan el menú lateral (tablet y
// computadora), la barra inferior del celular, la hoja "Más" y el título de
// la barra superior.

export interface ItemNav {
  icon: LucideIcon;
  label: string;
  path: string;
  grupo: "Operación" | "Carta" | "Gestión";
  roles: string[] | null;   // null: cualquier rol (sujeto a `modulo`)
  modulo: string | null;    // módulo de PermisoRol que habilita la sección
}

const ITEMS: ItemNav[] = [
  { icon: LayoutDashboard, label: "Panel", path: "/dashboard", grupo: "Operación", roles: [ROLES.ADMIN], modulo: null },
  // Cocina no tiene inicio: su pantalla principal es Cocina.
  { icon: House, label: "Inicio", path: "/home", grupo: "Operación", roles: [ROLES.CAJERO, ROLES.MESERO], modulo: null },
  { icon: Table2, label: "Mesas", path: "/mesas", grupo: "Operación", roles: null, modulo: "mesas" },
  { icon: ClipboardList, label: "Pedidos", path: "/ordenes", grupo: "Operación", roles: null, modulo: "ordenes" },
  { icon: ChefHat, label: "Cocina", path: "/cocina", grupo: "Operación", roles: null, modulo: "ordenes_cocina" },
  { icon: Receipt, label: "Caja", path: "/caja", grupo: "Operación", roles: [ROLES.ADMIN, ROLES.CAJERO], modulo: "caja" },
  { icon: Package, label: "Productos", path: "/productos", grupo: "Carta", roles: [ROLES.ADMIN], modulo: null },
  { icon: Tags, label: "Categorías", path: "/categorias", grupo: "Carta", roles: [ROLES.ADMIN], modulo: null },
  { icon: Tag, label: "Promociones", path: "/promociones", grupo: "Carta", roles: [ROLES.ADMIN], modulo: null },
  { icon: Boxes, label: "Insumos", path: "/insumos", grupo: "Carta", roles: [ROLES.ADMIN], modulo: null },
  { icon: BarChart3, label: "Reportes", path: "/reportes", grupo: "Gestión", roles: [ROLES.ADMIN], modulo: null },
  { icon: Users, label: "Usuarios", path: "/usuarios", grupo: "Gestión", roles: [ROLES.ADMIN], modulo: null },
  { icon: ShieldCheck, label: "Roles y permisos", path: "/roles", grupo: "Gestión", roles: [ROLES.ADMIN], modulo: null },
];

export const GRUPOS: ItemNav["grupo"][] = ["Operación", "Carta", "Gestión"];

export function itemsVisibles(): ItemNav[] {
  return ITEMS.filter(({ roles, modulo }) => {
    if (roles && !roles.some((rol) => authService.hasRole(rol))) return false;
    if (modulo && !authService.tieneModulo(modulo)) return false;
    return true;
  });
}

// Lo que cada rol usa todo el día va en la barra inferior del celular; el
// resto queda en "Más". Máximo 4 pestañas + "Más", para que cada ícono
// tenga espacio de sobra para el dedo.
const PRIORIDAD_MOVIL: Record<string, string[]> = {
  [ROLES.ADMIN]: ["/dashboard", "/mesas", "/ordenes", "/caja"],
  [ROLES.CAJERO]: ["/home", "/caja", "/ordenes", "/mesas"],
  [ROLES.MESERO]: ["/home", "/mesas", "/ordenes", "/cocina"],
  [ROLES.COCINA]: ["/cocina"],
};

export function pestanasMovil(visibles: ItemNav[]): { principales: ItemNav[]; resto: ItemNav[] } {
  const roles = authService.getUser().roles;
  const orden =
    [ROLES.ADMIN, ROLES.CAJERO, ROLES.MESERO, ROLES.COCINA]
      .filter((rol) => roles.includes(rol))
      .map((rol) => PRIORIDAD_MOVIL[rol])[0] ?? [];
  const principales = orden
    .map((path) => visibles.find((item) => item.path === path))
    .filter((item): item is ItemNav => Boolean(item))
    .slice(0, 4);
  const resto = visibles.filter((item) => !principales.includes(item));
  return { principales, resto };
}

const TITULOS_EXTRA: Record<string, string> = {
  "/comanda": "Comanda",
};
// Subrutas con título propio (se buscan antes que la sección).
const TITULOS_RUTA: Record<string, string> = {
  "/ordenes/nuevo": "Tomar pedido",
};

export function tituloDeRuta(pathname: string): string {
  if (TITULOS_RUTA[pathname]) return TITULOS_RUTA[pathname];
  const item = ITEMS.find((i) => pathname === i.path || pathname.startsWith(`${i.path}/`));
  if (item) return item.label;
  const extra = Object.keys(TITULOS_EXTRA).find((p) => pathname.startsWith(p));
  return extra ? TITULOS_EXTRA[extra] : "Memo's Coffee";
}

export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "U";
  return partes.slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

const NOMBRE_ROL: Record<string, string> = {
  [ROLES.ADMIN]: "Administración",
  [ROLES.CAJERO]: "Caja",
  [ROLES.MESERO]: "Salón",
  [ROLES.COCINA]: "Cocina",
};

export function nombreRol(roles: string[]): string {
  return NOMBRE_ROL[roles[0]] ?? "Personal";
}
