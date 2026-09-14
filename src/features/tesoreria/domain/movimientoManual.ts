/**
 * Q-15.7 · Validación pura del formulario de captura manual de movimiento
 * bancario (conciliación). Sin dependencias a React ni Supabase.
 */
export type TipoMovimientoManual = "cargo" | "abono";

export interface MovimientoManualInput {
  cuentaBancariaId: string;
  fecha: string;
  concepto: string;
  referencia?: string;
  tipo: TipoMovimientoManual;
  monto: number;
}

export interface MovimientoManualErrores {
  cuentaBancariaId?: string;
  fecha?: string;
  concepto?: string;
  monto?: string;
}

/**
 * N3 (v13.823.386): límites de fecha del movimiento manual.
 * - `hoyNegocio`: día de negocio en México (YYYY-MM-DD). Una captura con fecha
 *   futura alteraba el saldo y el flujo de hoy.
 * - `fechaCorte`: `cuentas_bancarias.fecha_saldo_inicial`. Una fecha anterior
 *   al corte quedaba fuera del saldo inicial de la cuenta.
 */
export interface LimitesFechaMovimiento {
  hoyNegocio?: string;
  fechaCorte?: string | null;
}

function fechaMx(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

/** Valida los campos del formulario y regresa un mapa de errores (vacío = válido). */
export function validarMovimientoManual(
  input: Partial<MovimientoManualInput>,
  limites: LimitesFechaMovimiento = {},
): MovimientoManualErrores {
  const errores: MovimientoManualErrores = {};
  if (!input.cuentaBancariaId) {
    errores.cuentaBancariaId = "Selecciona una cuenta bancaria.";
  }
  if (!input.fecha) {
    errores.fecha = "Captura la fecha del movimiento.";
  } else {
    const fecha = input.fecha.slice(0, 10);
    if (limites.hoyNegocio && fecha > limites.hoyNegocio) {
      errores.fecha = `La fecha no puede ser posterior a hoy (${fechaMx(limites.hoyNegocio)}).`;
    } else if (limites.fechaCorte && fecha < limites.fechaCorte.slice(0, 10)) {
      errores.fecha = `La fecha no puede ser anterior al corte de saldo inicial de la cuenta (${fechaMx(limites.fechaCorte)}).`;
    }
  }
  if (!input.concepto || !input.concepto.trim()) {
    errores.concepto = "Captura el concepto del movimiento.";
  }
  if (input.monto == null || Number.isNaN(input.monto) || input.monto <= 0) {
    errores.monto = "El importe debe ser mayor a cero.";
  }
  return errores;
}

export function esMovimientoManualValido(
  input: Partial<MovimientoManualInput>,
  limites: LimitesFechaMovimiento = {},
): boolean {
  return Object.keys(validarMovimientoManual(input, limites)).length === 0;
}
