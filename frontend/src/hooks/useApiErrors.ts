import { useState, useEffect } from "react";

const MENSAJES: Record<string, string> = {
  "api:forbidden":    "No tienes permisos para realizar esta acción.",
  "api:server-error": "Error en el servidor. Intenta de nuevo en unos momentos.",
  "api:network-error":"Sin conexión. Verifica tu red e intenta de nuevo.",
};

export default function useApiErrors() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handlers = Object.entries(MENSAJES).map(([event, mensaje]) => {
      const handler = () => setError(mensaje);
      window.addEventListener(event, handler);
      return { event, handler };
    });

    return () => {
      handlers.forEach(({ event, handler }) =>
        window.removeEventListener(event, handler)
      );
    };
  }, []);

  return { error, clearError: () => setError(null) };
}
