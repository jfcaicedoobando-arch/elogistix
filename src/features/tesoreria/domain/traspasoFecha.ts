import { hoyMx } from "@/lib/date/mx";
import { formatDate } from "@/lib/formatters";

interface CuentaConCorte { fecha_saldo_inicial: string }

/** Mismo límite inclusivo que registrar_traspaso_bancario (GREATEST de los cortes). */
export function fechaMinimaTraspaso(origen?: CuentaConCorte, destino?: CuentaConCorte): string | undefined {
  const fechas = [origen?.fecha_saldo_inicial, destino?.fecha_saldo_inicial]
    .filter((fecha): fecha is string => !!fecha);
  return fechas.sort().at(-1);
}

export function validarFechaTraspaso(fecha: string, minima?: string): string | null {
  if (!fecha) return "Captura la fecha del traspaso.";
  if (minima && fecha < minima) {
    return `La fecha del traspaso debe ser igual o posterior al ${formatDate(minima)}, el mayor corte de saldo inicial de las cuentas.`;
  }
  if (fecha > hoyMx()) return "La fecha del traspaso no puede ser futura.";
  return null;
}
