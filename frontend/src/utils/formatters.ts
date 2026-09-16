// Formatea moneda en soles peruanos
export const formatCurrency = (amount: number | string): string => {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(Number(amount));
};

// Formatea fecha legible
export const formatDate = (dateString: string): string => {
  return new Intl.DateTimeFormat("es-PE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString));
};

// Formatea fecha y hora
export const formatDateTime = (dateString: string): string => {
  return new Intl.DateTimeFormat("es-PE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
};

// Formatea fecha para inputs tipo date
export const formatDateInput = (dateString: string): string => {
  return new Date(dateString).toISOString().split("T")[0];
};
