/** Preflight del registro de un pago ya realizado. La RPC revalida bajo lock. */
import { todayLocalISO } from "@/lib/date/today";
import { esPagoEfectivo } from "./conciliacionPago";

export interface DatosPagoProgramado {
  cuentaBancariaId: string | null;
  fecha: string;
  monto: number;
  metodoPago: string;
  tipoCambio?: number | null;
}

interface FacturaPago {
  moneda: string;
  saldo?: number;
  fecha_emision?: string | null;
}

export function erroresPagoProgramado(
  pago: DatosPagoProgramado,
  factura: FacturaPago,
  hoy = todayLocalISO(),
): { monto?: string; fecha?: string; cuenta?: string; tipoCambio?: string } {
  const errores: ReturnType<typeof erroresPagoProgramado> = {};
  if (!Number.isFinite(pago.monto) || pago.monto <= 0) {
    errores.monto = "Captura un monto mayor que cero.";
  } else if (factura.saldo != null && pago.monto > factura.saldo + 0.005) {
    errores.monto = "El monto excede el saldo pendiente de la factura.";
  }
  errores.fecha = errorFechaPago(pago.fecha, factura.fecha_emision, hoy);
  if (!errores.fecha) delete errores.fecha;
  if (!esPagoEfectivo(pago.metodoPago) && !pago.cuentaBancariaId) {
    errores.cuenta = "Selecciona la cuenta bancaria del pago.";
  }
  if (factura.moneda.toUpperCase() !== "MXN"
    && (!Number.isFinite(pago.tipoCambio) || !(Number(pago.tipoCambio) > 0))) {
    errores.tipoCambio = "Captura un tipo de cambio válido, mayor que cero.";
  }
  return errores;
}

function errorFechaPago(valor: string, emision: string | null | undefined, hoy: string): string | undefined {
  const fecha = new Date(`${valor}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || Number.isNaN(fecha.getTime())
    || fecha.toISOString().slice(0, 10) !== valor) return "Captura una fecha válida.";
  if (valor > hoy) return "Un pago realizado no puede tener fecha futura.";
  if (emision && valor < emision) return "La fecha del pago no puede ser anterior a la emisión de la factura.";
  return undefined;
}
