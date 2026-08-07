/**
 * Exportación (lógica pura) del estado de cuenta bancario a CSV y PDF.
 * v13.450.0
 */
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toCsv } from "@/lib/csv/serializeCsv";
import type { EstadoCuentaBancario, MovimientoEstadoCuenta } from "@/features/tesoreria/domain/estadoCuenta";

export interface FilaEstadoCuentaExport {
  fecha: string;
  concepto: string;
  referencia: string;
  salida: string;
  entrada: string;
  saldo: string;
  estado: string;
}

export const ENCABEZADOS_ESTADO_CUENTA = [
  "Fecha",
  "Concepto",
  "Referencia",
  "Salida",
  "Entrada",
  "Saldo",
  "Estado",
] as const;

export function filasEstadoCuentaExport(
  movimientos: readonly MovimientoEstadoCuenta[],
  moneda: string,
): FilaEstadoCuentaExport[] {
  return movimientos.map((m) => ({
    fecha: formatDate(m.fecha),
    concepto: m.concepto ?? "—",
    referencia: m.referencia ?? "—",
    salida: m.cargo > 0 ? formatCurrency(m.cargo, moneda) : "",
    entrada: m.abono > 0 ? formatCurrency(m.abono, moneda) : "",
    saldo: formatCurrency(m.saldo_corrido, moneda),
    estado: m.estado_conciliacion,
  }));
}

export function estadoCuentaACsv(filas: readonly FilaEstadoCuentaExport[]): string {
  return toCsv(
    [...ENCABEZADOS_ESTADO_CUENTA],
    filas.map((f) => [f.fecha, f.concepto, f.referencia, f.salida, f.entrada, f.saldo, f.estado]),
  );
}

/** Resumen del periodo, ya formateado, para encabezar el CSV/PDF. */
export function resumenEstadoCuenta(estado: EstadoCuentaBancario): {
  periodo: string;
  saldoInicial: string;
  entradas: string;
  salidas: string;
  saldoFinal: string;
} {
  const m = estado.moneda;
  return {
    periodo: `${formatDate(estado.desde)} – ${formatDate(estado.hasta)}`,
    saldoInicial: formatCurrency(estado.saldo_inicial, m),
    entradas: formatCurrency(estado.total_entradas, m),
    salidas: formatCurrency(estado.total_salidas, m),
    saldoFinal: formatCurrency(estado.saldo_final, m),
  };
}

/** Nombre de archivo: `estado-cuenta-<alias>-<desde>-<hasta>.<ext>`. */
export function nombreArchivoEstadoCuenta(
  alias: string,
  desde: string,
  hasta: string,
  ext: "csv" | "pdf",
): string {
  const slug = (alias || "cuenta")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `estado-cuenta-${slug}-${desde}-${hasta}.${ext}`;
}
