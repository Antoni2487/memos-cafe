import axios from "axios";

interface ApiErrorBody {
  detail?: string;
}

// Extrae un mensaje legible de un error de axios (o cualquier otro), con un
// fallback cuando la respuesta no trae "detail" — mismo patrón repetido en
// hooks y páginas para mostrar errores de la API al usuario.
export function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    return err.response?.data?.detail ?? fallback;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
