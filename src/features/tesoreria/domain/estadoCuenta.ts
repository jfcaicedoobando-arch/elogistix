/**
 * Dominio puro del estado de cuenta bancario (v13.450.0).
 *
 * Contiene los tipos del reporte, los atajos de periodo (mes / trimestre / año)
 * y el filtrado en memoria de los movimientos ya traídos del servidor.
 * Sin dependencias de red ni de React.
 */

export type TipoMovimientoEstadoCuenta = "todos" | "entradas" | "salidas";

export interface MovimientoEstadoCuenta {
  id: string;
  fecha: string;
  concepto: string | null;
  referencia: string | null;
  cargo: number;
  abono: number;
  estado_conciliacion: string;
  saldo_corrido: number;
  pago_factura_id: string | null;
  pago_proveedor_id: string | null;
  anticipo_proveedor_id: string | null;
  pago_proveedor_lote_id: string | null;
}

export interface EstadoCuentaBancario {
  cuenta_id: string;
  alias: string;
  banco: string;
  moneda: string;
  desde: string;
  hasta: string;
  saldo_inicial: number;
  total_entradas: number;
  total_salidas: number;
  saldo_final: number;
  /** Fecha de corte del saldo inicial de la cuenta (arranque en el sistema). */
  fecha_saldo_inicial: string | null;
  /** Movimientos con fecha anterior al corte: existen pero no afectan el saldo. */
  movimientos_previos_corte: number;
  movimientos: MovimientoEstadoCuenta[];
}

export interface RangoFechas {
  desde: string;
  hasta: string;
}

function iso(anio: number, mes0: number, dia: number): string {
  return [
    String(anio).padStart(4, "0"),
    String(mes0 + 1).padStart(2, "0"),
    String(dia).padStart(2, "0"),
  ].join("-");
}

function ultimoDiaDelMes(anio: number, mes0: number): number {
  return new Date(anio, mes0 + 1, 0).getDate();
}

/** Mes calendario de `base` (por defecto, hoy). */
export function rangoMes(base: Date = new Date()): RangoFechas {
  const a = base.getFullYear();
  const m = base.getMonth();
  return { desde: iso(a, m, 1), hasta: iso(a, m, ultimoDiaDelMes(a, m)) };
}

/** Trimestre calendario que contiene a `base`. */
export function rangoTrimestre(base: Date = new Date()): RangoFechas {
  const a = base.getFullYear();
  const inicio = Math.floor(base.getMonth() / 3) * 3;
  const fin = inicio + 2;
  return { desde: iso(a, inicio, 1), hasta: iso(a, fin, ultimoDiaDelMes(a, fin)) };
}

/** Año calendario de `base`. */
export function rangoAnio(base: Date = new Date()): RangoFechas {
  const a = base.getFullYear();
  return { desde: iso(a, 0, 1), hasta: iso(a, 11, 31) };
}

export function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export interface FiltrosEstadoCuenta {
  texto: string;
  tipo: TipoMovimientoEstadoCuenta;
}

/**
 * Filtra los movimientos en memoria. El `saldo_corrido` NO se recalcula:
 * siempre refleja el saldo real de la cuenta en ese movimiento.
 */
export function filtrarMovimientos(
  movimientos: readonly MovimientoEstadoCuenta[],
  { texto, tipo }: FiltrosEstadoCuenta,
): MovimientoEstadoCuenta[] {
  const q = normalizarTexto(texto);
  return movimientos.filter((m) => {
    if (tipo === "entradas" && !(m.abono > 0)) return false;
    if (tipo === "salidas" && !(m.cargo > 0)) return false;
    if (!q) return true;
    const campo = normalizarTexto(`${m.concepto ?? ""} ${m.referencia ?? ""}`);
    return campo.includes(q);
  });
}

/** Totales de los movimientos visibles (para el pie de la tabla). */
export function totalesVisibles(
  movimientos: readonly MovimientoEstadoCuenta[],
): { entradas: number; salidas: number } {
  return movimientos.reduce(
    (acc, m) => ({ entradas: acc.entradas + m.abono, salidas: acc.salidas + m.cargo }),
    { entradas: 0, salidas: 0 },
  );
}
