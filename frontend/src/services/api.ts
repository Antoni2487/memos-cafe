import axios, { AxiosHeaders } from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

const api = axios.create({
  baseURL: API_URL,
});

// ── Request interceptor ──────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.set("Authorization", `Bearer ${token}`);

    // Solo fija JSON si no es FormData — para FormData axios detecta solo
    if (!(config.data instanceof FormData)) {
      config.headers.set("Content-Type", "application/json");
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor ─────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);

    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const status = error.response?.status;

    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem("refresh_token");
        if (!refreshToken) throw new Error("No refresh token");
        const { data } = await axios.post<{ access: string }>(`${API_URL}/auth/refresh/`, {
          refresh: refreshToken,
        });
        localStorage.setItem("access_token", data.access);
        originalRequest.headers = originalRequest.headers ?? new AxiosHeaders();
        originalRequest.headers.set("Authorization", `Bearer ${data.access}`);
        return api(originalRequest);
      } catch {
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(error);
      }
    }

    if (status === 403) window.dispatchEvent(new CustomEvent("api:forbidden"));
    if (status && status >= 500) window.dispatchEvent(new CustomEvent("api:server-error"));
    if (!error.response) window.dispatchEvent(new CustomEvent("api:network-error"));

    return Promise.reject(error);
  }
);

export default api;
