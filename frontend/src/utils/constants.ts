// Roles del sistema
export const ROLES = {
  ADMIN: "admin",
  CAJERO: "cajero",
  MESERO: "mesero",
} as const;

// Estados de mesa
export const ESTADO_MESA = {
  LIBRE: "libre",
  OCUPADA: "ocupada",
  RESERVADA: "reservada",
} as const;

// Estados de orden
export const ESTADO_ORDEN = {
  ABIERTA: "abierta",
  CERRADA: "cerrada",
  ANULADA: "anulada",
} as const;

// Tipos de orden
export const TIPO_ORDEN = {
  MESA: "mesa",
  LLEVAR: "llevar",
  DELIVERY: "delivery",
} as const;

// Plataformas de delivery
export const PLATAFORMA_DELIVERY = {
  RAPPI: "rappi",
  PEDIDOS_YA: "pedidos_ya",
  DIDI: "didi",
  OTRO: "otro",
} as const;

// Métodos de pago
export const METODO_PAGO = {
  EFECTIVO: "efectivo",
  TARJETA: "tarjeta",
  YAPE: "yape",
  PLIN: "plin",
} as const;

// Tipos de comprobante
export const TIPO_COMPROBANTE = {
  BOLETA: "boleta",
  FACTURA: "factura",
} as const;

// Estados de caja
export const ESTADO_CAJA = {
  ABIERTA: "abierta",
  CERRADA: "cerrada",
} as const;
