/**
 * ¿Hay captura sin guardar en el diálogo de registrar pago del cliente?
 *
 * Se compara contra el baseline con el que se inicializó el formulario (fecha
 * de hoy, saldo prellenado, moneda de la factura, forma de pago 03 y sin
 * cuenta). Así cambiar SÓLO la fecha, la moneda, la forma de pago o la cuenta
 * también avisa antes de descartar, y abrir sin editar no avisa.
 */
import type { PagoFormValues } from "./PagoFormFields";

const CAMPOS: (keyof PagoFormValues)[] = [
  "fecha", "monto", "moneda", "formaPago", "referencia", "notas", "cuentaBancariaId",
];

export function pagoClienteSucio(
  actual: PagoFormValues,
  baseline: PagoFormValues | null,
): boolean {
  if (!baseline) return false;
  return CAMPOS.some((k) => actual[k] !== baseline[k]);
}
