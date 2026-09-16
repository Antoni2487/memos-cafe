import api from "./api";
import type { ReporteCaja, ReporteProductos, ReporteVentas } from "../types";

export interface RangoFechas {
  fecha_inicio: string;
  fecha_fin: string;
}

const reporteService = {
  // Reporte de ventas por rango de fechas
  getVentas: (params: RangoFechas) =>
    api.get<ReporteVentas>("/reportes/ventas/", { params }),

  // Reporte de productos más vendidos
  getProductos: (params: RangoFechas) =>
    api.get<ReporteProductos>("/reportes/productos/", { params }),

  // Reporte de caja por turno o rango de fechas
  getCaja: (params: RangoFechas) =>
    api.get<ReporteCaja>("/reportes/caja/", { params }),

  // Exportar ventas a Excel — descarga directa
  exportarVentas: (params: RangoFechas) =>
    api.get<Blob>("/reportes/ventas/export/", {
      params,
      responseType: "blob",
    }),

  // Exportar caja a Excel — descarga directa
  exportarCaja: (params: RangoFechas) =>
    api.get<Blob>("/reportes/caja/export/", {
      params,
      responseType: "blob",
    }),

  // Exportar productos a Excel — descarga directa
  exportarProductos: (params: RangoFechas) =>
    api.get<Blob>("/reportes/productos/export/", {
      params,
      responseType: "blob",
    }),
};

// Utilidad para disparar la descarga del blob en el navegador
export function descargarBlob(blob: Blob, nombreArchivo: string): void {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export default reporteService;
