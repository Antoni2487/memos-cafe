// Validadores reusables para formularios de todo el sistema.
// Los límites de LIMITES espejan los max_length de los serializers del backend
// (fuente de verdad real); esto es solo feedback inmediato para el usuario.

export const REGEX = {
  SOLO_NUMERICO: /^[0-9]*$/,
  SOLO_ALFABETICO: /^[a-zA-ZÀ-ÿñÑ\s'-]*$/,
  SOLO_ALFANUMERICO: /^[a-zA-Z0-9À-ÿñÑ\s.,#°/-]*$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  DNI: /^\d{8}$/,
  RUC: /^\d{11}$/,
};

export const esSoloNumerico = (valor?: string | null): boolean => REGEX.SOLO_NUMERICO.test(valor ?? "");
export const esSoloAlfabetico = (valor?: string | null): boolean => REGEX.SOLO_ALFABETICO.test(valor ?? "");
export const esSoloAlfanumerico = (valor?: string | null): boolean => REGEX.SOLO_ALFANUMERICO.test(valor ?? "");
export const esEmailValido = (valor?: string | null): boolean => REGEX.EMAIL.test(valor ?? "");
export const esDniValido = (valor?: string | null): boolean => REGEX.DNI.test(valor ?? "");
export const esRucValido = (valor?: string | null): boolean => REGEX.RUC.test(valor ?? "");

// Valida el DNI/RUC según el tipo de comprobante. En boleta el documento es
// opcional (consumidor final anónimo); en factura es obligatorio y debe ser RUC.
export function validarDocumentoComprobante(tipo: string, valor?: string | null): string | null {
  const doc = (valor ?? "").trim();
  if (tipo === "factura") {
    if (!doc) return MENSAJES.RUC_REQUERIDO;
    if (!esRucValido(doc)) return MENSAJES.RUC_INVALIDO;
    return null;
  }
  // boleta
  if (doc && !esDniValido(doc)) return MENSAJES.DNI_INVALIDO;
  return null;
}

export const MENSAJES = {
  SOLO_NUMERICO: "Solo se permiten números",
  SOLO_ALFABETICO: "Solo se permiten letras",
  SOLO_ALFANUMERICO: "Solo se permiten letras y números",
  EMAIL_INVALIDO: "Ingresá un correo válido",
  DNI_INVALIDO: "El DNI debe tener exactamente 8 dígitos numéricos",
  RUC_INVALIDO: "El RUC debe tener exactamente 11 dígitos numéricos",
  RUC_REQUERIDO: "Para una factura se requiere el RUC del cliente",
  maxLength: (max: number): string => `Máximo ${max} caracteres`,
};

// Límites de caracteres — mismos valores que los max_length del backend.
export const LIMITES = {
  NOMBRE_CATEGORIA: 60,
  NOMBRE: 100,
  NOMBRE_PERSONA: 150,
  NOMBRE_USUARIO: 255,
  DESCRIPCION: 500,
  DIRECCION: 255,
  TELEFONO: 20,
  OBSERVACIONES: 255,
  PROVEEDOR: 150,
  NOTA: 150,
  MOTIVO: 200,
  SERIE: 10,
  NUM_OPERACION: 50,
  RUC_DNI: 11,
  GROUP_NAME: 150,
  PLATAFORMA_OTRA: 100,
  EMAIL: 254,
  PASSWORD: 128,
};

// Rangos de los campos numéricos — los mismos que valida el backend
// (memos_cafe/utils/limites.py). Con ellos el campo ni siquiera deja
// escribir un número negativo, con más decimales de la cuenta o más grande
// que el máximo (antes se podía escribir "8888888888…" como número de mesa).
export interface Rango {
  min: number;
  max: number;
  decimales: number;
}

export const RANGOS = {
  MESA_NUMERO: { min: 1, max: 999, decimales: 0 },
  CAPACIDAD: { min: 1, max: 30, decimales: 0 },
  CANTIDAD: { min: 1, max: 99, decimales: 0 },
  PRECIO: { min: 0.1, max: 9999.99, decimales: 2 },
  MONTO: { min: 0, max: 99999.99, decimales: 2 },
  CANTIDAD_INSUMO: { min: 0, max: 999999.99, decimales: 2 },
  NUMERO_COMPROBANTE: { min: 1, max: 99999999, decimales: 0 },
} satisfies Record<string, Rango>;

/** ¿Se puede seguir escribiendo este valor en un campo con este rango? */
export function admiteNumero(valor: string, rango: Rango): boolean {
  if (valor === "") return true;
  const patron = rango.decimales
    ? new RegExp(`^\\d+(\\.\\d{0,${rango.decimales}})?$`)
    : /^\d+$/;
  return patron.test(valor) && Number(valor) <= rango.max;
}

const formatoNumero = (n: number, decimales: number) =>
  n.toLocaleString("es-PE", { minimumFractionDigits: decimales ? 2 : 0, maximumFractionDigits: decimales });

/** Mensaje de error si el valor está fuera del rango (o null si está bien). */
export function errorDeRango(valor: string, rango: Rango, nombre = "El valor"): string | null {
  if (valor.trim() === "") return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) return `${nombre} debe ser un número`;
  if (n < rango.min) return `${nombre} debe ser al menos ${formatoNumero(rango.min, rango.decimales)}`;
  if (n > rango.max) return `${nombre} puede ser como máximo ${formatoNumero(rango.max, rango.decimales)}`;
  return null;
}
