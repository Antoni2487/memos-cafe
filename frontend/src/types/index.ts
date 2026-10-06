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
  /** Codigo secreto que va impreso en el QR de la mesa (solo personal). */
  codigo_qr?: string;
}

// ── Croquis del salón (GET/PUT /api/mesas/plano/) ────────────────────────

export type FormaPlano = "redonda" | "rectangular";

/** Posición y forma en el lienzo del plano (unidades del plano, no px). */
export interface GeometriaPlano {
  plano_x: number | null;
  plano_y: number | null;
  plano_ancho: number;
  plano_alto: number;
  forma: FormaPlano;
  rotacion: number;
}

/** Lo que pasa en una mesa con movimiento (PlanoService.resumen_sala). */
export interface SalaMesa {
  orden_id: number | null;
  total: string | null;
  abierta_en: string | null;
  cliente_nombre: string;
  mesero: string;
  comandas: Record<"pendiente" | "en_preparacion" | "lista" | "entregada", number>;
  comanda_esperando_desde: string | null;
  pide_cuenta: boolean;
  /** Cómo dijo el cliente que va a pagar al pedir la cuenta por QR. */
  metodo_cuenta: string | null;
  pedido_por_confirmar_id: number | null;
}

export interface MesaPlano extends GeometriaPlano {
  id: number;
  numero: number;
  capacidad: number;
  estado: EstadoMesa;
  estado_display: string;
  codigo_qr: string;
  sala: SalaMesa | null;
}

export type TipoElementoPlano = "barra" | "pared" | "entrada" | "texto";

export interface ElementoPlano extends GeometriaPlano {
  id?: number | null;
  tipo: TipoElementoPlano;
  etiqueta: string;
  plano_x: number;
  plano_y: number;
}

export interface Plano {
  ancho: number;
  alto: number;
  siguiente_numero: number;
  mesas: MesaPlano[];
  elementos: ElementoPlano[];
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
  precio_unitario?: number | string;
  subtotal?: number | string;
  nota?: string;
  impreso?: boolean;
  ronda?: number;
  estado_preparacion?: EstadoPreparacion;
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
  estado_display?: string;
  fecha_cierre?: string | null;
  pagos_resumen?: PagoResumen[];
  /** El cliente pidió la cuenta por QR (y cómo quiere pagar). */
  cuenta_pedida?: { metodo: string; solicitado_en: string } | null;
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

/** Reporte de tiempos (GET /reportes/tiempos/). Todo en segundos. */
export interface TiempoResumen {
  mediana: number | null;
  p90: number | null;
  n: number;
}

export interface ReporteTiempos {
  periodo: { inicio: string; fin: string };
  objetivo_min: number;
  total: TiempoResumen & { a_tiempo_pct: number | null };
  etapas: (TiempoResumen & { clave: "espera" | "preparacion" | "servir" | "cobro"; nombre: string; descripcion: string })[];
  por_hora: { hora: number; comandas: number; mediana: number }[];
  por_producto: { nombre: string; rondas: number; mediana_preparacion: number }[];
  por_mesero: { nombre: string; rondas: number; mediana_servir: number }[];
  demoras: { comanda_id: number; fecha: string; destino: string; ronda: number; total: number; etapa_mas_larga: string | null }[];
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

// ── Cocina / Pedido por QR ──────────────────────────────────────────────

export type EstadoPreparacion = "pendiente" | "en_preparacion" | "listo" | "entregado";

// Tablero de Cocina — GET /api/ordenes/cocina/ (serializer liviano, sin
// precios ni datos de cliente/pago).
export interface DetalleCocina {
  id: number;
  nombre: string;
  cantidad: number;
  nota?: string;
  ronda: number;
  estado_preparacion: EstadoPreparacion;
  fecha_creacion: string;
}

export interface TicketCocina {
  id: number;
  mesa_numero: number | null;
  tipo_orden: TipoOrden;
  tipo_orden_display?: string;
  fecha_creacion: string;
  detalles: DetalleCocina[];
}

// Pedido por QR — endpoints públicos (sin login) bajo /api/mesas/qr/.
export interface DetalleQR {
  id: number;
  nombre: string;
  cantidad: number;
  precio_unitario: number | string;
  subtotal: number | string;
  nota?: string;
  ronda: number;
  estado_preparacion: EstadoPreparacion;
}

export type EstadoComanda = "pendiente" | "en_preparacion" | "lista" | "entregada";

/** Una comanda en el tablero de Cocina (sin precios). */
export interface ComandaCocina {
  id: number;
  numero: number;
  origen: "mesero" | "qr";
  estado: EstadoComanda;
  creada_en: string;
  iniciada_en: string | null;
  lista_en: string | null;
  orden_id: number;
  mesa_numero: number | null;
  tipo_orden: TipoOrden;
  tipo_orden_display: string;
  cliente_nombre: string;
  mesero: string;
  mesero_id: number | null;
  /** Delivery: la app que pasa a recogerlo ("" en mesa y para llevar). */
  plataforma: string;
  /** Segundos transcurridos según el reloj del servidor al responder. */
  segundos: { desde_creada: number; desde_iniciada: number | null; desde_lista: number | null };
  detalles: DetalleCocina[];
}

/** Cada envío a Cocina (ronda) del pedido de la mesa. */
export interface ComandaQR {
  numero: number;
  origen: "mesero" | "qr";
  estado: EstadoComanda;
  creada_en: string;
}

export interface OrdenQR {
  id: number;
  estado: EstadoOrden;
  total: number | string;
  detalles: DetalleQR[];
  comandas: ComandaQR[];
  cuenta_solicitada: boolean;
}

/** Item tal como lo vio el cliente (nombre y precio de ese momento). */
export interface ItemPorConfirmar {
  producto: number | null;
  promocion: number | null;
  cantidad: number;
  nota: string;
  nombre: string;
  precio: string;
}

/** Primer pedido de una mesa libre: espera a que el mesero lo confirme. */
export interface PedidoPorConfirmarQR {
  id: number;
  estado: "pendiente" | "confirmado" | "rechazado" | "expirado";
  items: ItemPorConfirmar[];
  total: string;
  creado_en: string;
  segundos_esperando: number;
}

export interface SesionMesaQREstado {
  sesion_activa: boolean;
  mesa_numero: number;
  orden: OrdenQR | null;
  pedido_por_confirmar: PedidoPorConfirmarQR | null;
}

/** POST del pedido: va directo a Cocina (orden) o espera al mesero. */
export type RespuestaPedidoQR =
  | { tipo: "orden"; orden: OrdenQR }
  | { tipo: "por_confirmar"; pedido: PedidoPorConfirmarQR };
