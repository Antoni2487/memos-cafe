import { getAll } from "./api";
import type { Mesa, Orden } from "../types";

const homeService = {
  getMesas:   () => getAll<Mesa>("/mesas/"),
  getOrdenes: () => getAll<Orden>("/ordenes/"),
};

export default homeService;
