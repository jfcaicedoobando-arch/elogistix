import { format, parseISO } from "date-fns";

export const formatCurrency = (amount: number, currency: string = 'MXN'): string => {
  const formatter = new Intl.NumberFormat('es-MX', { style: 'currency', currency, minimumFractionDigits: 2 });
  return formatter.format(amount);
};

/** Extrae la primera parte de un nombre compuesto (antes de coma o guión largo) */
export const shortName = (raw: string | null): string =>
  raw?.split(/[,—]/)[0].trim() || "-";

/** Formatea una fecha ISO a formato legible. Si se pasa formatStr se usa ese formato. */
export const formatDate = (dateStr: string, formatStr: string = 'dd/MM/yyyy'): string => {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), formatStr);
  } catch {
    return dateStr;
  }
};
