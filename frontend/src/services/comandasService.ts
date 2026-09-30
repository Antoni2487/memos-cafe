import api from "./api";
import type { ComandaCocina } from "../types";

// Tablero de Cocina por comanda (ver ComandaViewSet en ordenes/api/views.py).
const comandasService = {
  tablero: () => api.get<ComandaCocina[]>("/ordenes/comandas/cocina/"),
  iniciar: (id: number) => api.post<ComandaCocina>(`/ordenes/comandas/${id}/iniciar/`),
  marcarItem: (id: number, detalleId: number, listo: boolean) =>
    api.post<ComandaCocina>(`/ordenes/comandas/${id}/items/${detalleId}/check/`, { listo }),
  lista: (id: number) => api.post<ComandaCocina>(`/ordenes/comandas/${id}/lista/`),
  entregar: (id: number) => api.post<ComandaCocina>(`/ordenes/comandas/${id}/entregar/`),
};

export default comandasService;
