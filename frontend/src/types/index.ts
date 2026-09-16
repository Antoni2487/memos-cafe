// Tipos de dominio compartidos por toda la app — reflejan la forma de los
// datos que expone la API (ver serializers del backend), no un modelo aparte.

import type { ReactNode } from "react";

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface SelectOption<T extends string | number = string> {
  value: T;
  label: string;
}

export interface Grupo {
  name: string;
}

export interface Usuario {
  id: number;
  name: string;
  email: string;
  is_active: boolean;
  date_joined?: string;
  groups?: Grupo[];
}

export interface UsuarioAuth {
  id: string;
  email: string;
  nombre: string;
  roles: string[];
}

export interface PermisoRol {
  id: number;
  rol: string;
  modulo: string;
  modulo_label: string;
  puede_acceder: boolean;
}

export interface Categoria {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Producto {
  id: number;
  nombre: string;
  descripcion?: string;
  precio: number | string;
  precio_venta?: number | string;
  categoria?: number | string;
  categoria_nombre?: string;
  disponible: boolean;
  imagen?: string | null;
}

export interface Promocion {
  id: number;
  nombre: string;
  descripcion?: string;
  precio: number | string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
  vigente?: boolean;
  imagen?: string | null;
}

export type EstadoMesa = "libre" | "ocupada" | "reservada";

export interface Mesa {
  id: number;
  numero: number;
  capacidad: number;
  estado: EstadoMesa;
  activo?: boolean;
}

export interface ItemRef {
  id: number;
  nombre: string;
}

export interface DetalleOrden {
  id: number;
  producto?: ItemRef | null;
  promocion?: ItemRef | null;
  cantidad: number;
  subtotal?: number | string;
  nota?: string;
  impreso?: boolean;
}

export interface PagoResumen {
  id: number;
  estado: string;
  monto: number | string;
}

export type TipoOrden = "mesa" | "llevar" | "delivery";
export type EstadoOrden = "abierta" | "cerrada" | "anulada";

export interface Orden {
  id: number;
  tipo_orden: TipoOrden;
  tipo_orden_display?: string;
  estado: EstadoOrden;
  mesa?: number | null;
  mesa_numero?: number;
  cliente_nombre?: string;
  cliente_telefono?: string;
  direccion_entrega?: string;
  plataforma_delivery?: string;
  plataforma_otra?: string;
  detalles: DetalleOrden[];
  total: number | string;
  fecha_creacion: string;
  usuario_nombre?: string;
  pagos_resumen?: PagoResumen[];
}

export interface Insumo {
  id: number;
  nombre: string;
  unidad: string;
  unidad_display?: string;
  stock_actual: number | string;
  stock_minimo: number | string;
  stock_bajo?: boolean;
  activo: boolean;
}

export interface RegistroInsumo {
  id: number;
  insumo?: number | string;
  insumo_nombre?: string;
  insumo_unidad?: string;
  cantidad: number | string;
  costo_unitario: number | string;
  costo_total: number | string;
  proveedor?: string;
  observaciones?: string;
  fecha: string;
}

export interface CajaSesion {
  id: number;
  usuario_nombre?: string;
  monto_inicial: number | string;
  monto_final?: number | string;
  total_ventas?: number | string;
  diferencia?: number | string;
  fecha_apertura?: string;
}

export type TipoMovimiento = "entrada" | "salida";

export interface Movimiento {
  id: number;
  tipo: TipoMovimiento;
  monto: number | string;
  motivo: string;
}

export type TipoComprobante = "boleta" | "factura";

export interface Comprobante {
  tipo: TipoComprobante;
  serie: string;
  numero: number;
}

export interface OrdenPago {
  id: number;
  detalles?: DetalleOrden[];
  total?: number | string;
}

export interface Pago {
  id: number;
  orden?: OrdenPago | null;
  metodo_pago: string;
  metodo_pago_display?: string;
  monto: number | string;
  vuelto?: number | string;
  numero_operacion?: string;
  estado: "completado" | "anulado";
  fecha: string;
  comprobante?: Comprobante | null;
}

export interface Alerta {
  icono: "caja" | "orden" | "venta" | string;
  mensaje: string;
  fecha: string;
}

export interface DashboardVentas {
  total: number;
  ticket_promedio: number;
  mes: number;
  anio: number;
}

export interface DashboardOrdenes {
  abiertas: number;
  cerradas_hoy: number;
  anuladas_hoy: number;
}

export interface DashboardMesas {
  total: number;
  libres: number;
  ocupadas: number;
  reservadas: number;
}

export interface DashboardVentaPorDia {
  fecha: string;
  total: number | string;
  ordenes: number;
}

export interface DashboardVentaPorMetodo {
  metodo_pago: string;
  total: number | string;
}

export interface DashboardTopProducto {
  nombre: string;
  cantidad: number;
}

export interface DashboardCajaActiva {
  cajero: string;
  monto_inicial: number | string;
  ventas_turno: number | string;
  fecha_apertura: string;
}

export interface DashboardData {
  ventas?: DashboardVentas;
  ordenes?: DashboardOrdenes;
  mesas?: DashboardMesas;
  ventas_por_dia?: DashboardVentaPorDia[];
  ventas_por_metodo?: DashboardVentaPorMetodo[];
  top_productos?: DashboardTopProducto[];
  caja_activa?: DashboardCajaActiva | null;
}

export interface ReporteVentasPorDia {
  fecha_dia: string;
  total: number | string;
  ordenes: number;
}

export interface ReporteVentasPorMetodo {
  metodo_pago: string;
  total: number | string;
  cantidad: number;
}

export interface ReporteVentas {
  total_ventas: number | string;
  total_ordenes: number;
  ticket_promedio: number | string;
  ventas_por_dia?: ReporteVentasPorDia[];
  ventas_por_metodo_pago?: ReporteVentasPorMetodo[];
}

export interface ReporteProductoItem {
  nombre: string;
  categoria?: string | null;
  cantidad: number;
  total: number | string;
}

export interface ReporteProductos {
  productos?: ReporteProductoItem[];
  promociones?: ReporteProductoItem[];
}

export interface ReporteCajaTurno {
  caja_id: number;
  cajero: string;
  estado: string;
  fecha_apertura: string | null;
  total_ventas: number | string;
  diferencia: number | string | null;
}

export interface ReporteCaja {
  turnos?: ReporteCajaTurno[];
}

export interface Columna<T> {
  key?: string;
  label: string;
  width?: string;
  render?: (fila: T) => ReactNode;
}
