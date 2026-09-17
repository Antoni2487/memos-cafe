import { useEffect, useRef, useState } from "react";

export type StaffSocketStatus = "conectando" | "conectado" | "reconectando";

// Deriva ws(s)://host/ws/<path>/ a partir de VITE_API_URL (http(s)://host/api).
// El JWT va en la query string: el handshake nativo de WebSocket no permite
// headers custom, y el backend lo valida ahi (ver realtime/middleware.py).
function wsUrl(path: "cocina" | "meseros"): string {
  const apiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
  const url = new URL(apiUrl);
  const protocolo = url.protocol === "https:" ? "wss:" : "ws:";
  const token = localStorage.getItem("access_token") || "";
  return `${protocolo}//${url.host}/ws/${path}/?token=${encodeURIComponent(token)}`;
}

/**
 * Conexión WebSocket a un canal de staff (cocina/meseros) con reconexión
 * automática y backoff exponencial (tope 15s) — tolera el "cold start" de
 * Render free tier cuando el servicio estuvo dormido.
 */
export default function useStaffSocket(
  path: "cocina" | "meseros",
  onEvento: (evento: Record<string, unknown>) => void,
  activo: boolean = true
): StaffSocketStatus {
  const [status, setStatus] = useState<StaffSocketStatus>("conectando");
  const onEventoRef = useRef(onEvento);

  useEffect(() => {
    onEventoRef.current = onEvento;
  }, [onEvento]);

  useEffect(() => {
    if (!activo) return;

    let socket: WebSocket | null = null;
    let intentos = 0;
    let timeoutId: ReturnType<typeof setTimeout>;
    let cerradoPorLimpieza = false;

    const conectar = () => {
      setStatus(intentos === 0 ? "conectando" : "reconectando");
      socket = new WebSocket(wsUrl(path));

      socket.onopen = () => {
        intentos = 0;
        setStatus("conectado");
      };

      socket.onmessage = (event) => {
        try {
          onEventoRef.current(JSON.parse(event.data));
        } catch {
          // mensaje malformado — se ignora, no debe tumbar la conexión
        }
      };

      socket.onclose = () => {
        if (cerradoPorLimpieza) return;
        setStatus("reconectando");
        const espera = Math.min(1000 * 2 ** intentos, 15000);
        intentos += 1;
        timeoutId = setTimeout(conectar, espera);
      };

      socket.onerror = () => socket?.close();
    };

    conectar();

    return () => {
      cerradoPorLimpieza = true;
      clearTimeout(timeoutId);
      socket?.close();
    };
  }, [path, activo]);

  return status;
}
