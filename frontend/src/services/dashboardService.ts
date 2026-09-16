import api from "./api";
import type { DashboardData } from "../types";

const dashboardService = {
  getDashboard: async (): Promise<DashboardData> => {
    const response = await api.get<DashboardData>("/dashboard/");
    return response.data;
  },
};

export default dashboardService;
