import { format, isValid, parseISO } from "date-fns";

/** Rechaza fechas vacías, parciales y días imposibles antes de guardar la NC. */
export function fechaNotaCreditoValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const date = parseISO(fecha);
  return isValid(date) && format(date, "yyyy-MM-dd") === fecha;
}

export function validarFechaNotaCredito(fecha: string): void {
  if (!fechaNotaCreditoValida(fecha)) throw new Error("Captura una fecha válida para la nota de crédito.");
}
