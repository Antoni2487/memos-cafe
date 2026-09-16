import api from "./api";
import type { Mesa, Orden, Paginated } from "../types";

const homeService = {
  getMesas:   () => api.get<Paginated<Mesa> | Mesa[]>("/mesas/"),
  getOrdenes: () => api.get<Paginated<Orden> | Orden[]>("/ordenes/"),
};

export default homeService;
