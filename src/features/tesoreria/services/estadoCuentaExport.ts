/**
 * Exportación (lógica pura) del estado de cuenta bancario a CSV y PDF.
 * v13.450.0
 */
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toCsv } from "@/lib/csv/serializeCsv";
import type { EstadoCuentaBancario, MovimientoEstadoCuenta } from "@/features/tesoreria/domain/estadoCuenta";
import { totalesVisibles, type FiltrosEstadoCuenta } from "@/features/tesoreria/domain/estadoCuenta";

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
  cobertura: string | null;
  saldoInicial: string;
  entradas: string;
  salidas: string;
  saldoFinal: string;
} {
  const m = estado.moneda;
  const importe = (valor: number | null) => valor === null ? "No disponible" : formatCurrency(valor, m);
  const cobertura = estado.cobertura_historica === "sin_cobertura"
    ? `No hay cobertura histórica para el periodo seleccionado. Los saldos y movimientos están disponibles desde el arranque de la cuenta${estado.fecha_saldo_inicial ? `, el ${formatDate(estado.fecha_saldo_inicial)}` : ""}. Selecciona un periodo que incluya esa fecha o una posterior.`
    : estado.cobertura_historica === "parcial"
      ? `El periodo solicitado comienza el ${formatDate(estado.desde_solicitado)}, antes del arranque de la cuenta. El resumen y los movimientos abarcan únicamente del ${formatDate(estado.desde)} al ${formatDate(estado.hasta)}; el saldo inicial corresponde al arranque. No hay cobertura histórica anterior.`
      : null;
  return {
    periodo: `${formatDate(estado.desde)} – ${formatDate(estado.hasta)}`,
    cobertura,
    saldoInicial: importe(estado.saldo_inicial),
    entradas: importe(estado.total_entradas),
    salidas: importe(estado.total_salidas),
    saldoFinal: importe(estado.saldo_final),
  };
}

/** Alcance de la tabla exportada; el saldo corrido sigue siendo el de la cuenta. */
export function alcanceEstadoCuentaExport(
  estado: EstadoCuentaBancario,
  movimientos: readonly MovimientoEstadoCuenta[],
  filtros: FiltrosEstadoCuenta,
): { filtro: string; movimientosVisibles: number; movimientosPeriodo: number; entradas: string; salidas: string } {
  const totales = totalesVisibles(movimientos);
  const etiquetas = [
    filtros.texto.trim() ? `Búsqueda: ${filtros.texto.trim()}` : "",
    filtros.tipo === "entradas" ? "Tipo: entradas" : filtros.tipo === "salidas" ? "Tipo: salidas" : "",
  ].filter(Boolean);
  return {
    filtro: etiquetas.length ? etiquetas.join(" | ") : "Sin filtros de búsqueda o tipo",
    movimientosVisibles: movimientos.length,
    movimientosPeriodo: estado.movimientos.length,
    entradas: formatCurrency(totales.entradas, estado.moneda),
    salidas: formatCurrency(totales.salidas, estado.moneda),
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
