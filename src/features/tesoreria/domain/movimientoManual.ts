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

/** Valida los campos del formulario y regresa un mapa de errores (vacío = válido). */
export function validarMovimientoManual(
  input: Partial<MovimientoManualInput>,
): MovimientoManualErrores {
  const errores: MovimientoManualErrores = {};
  if (!input.cuentaBancariaId) {
    errores.cuentaBancariaId = "Selecciona una cuenta bancaria.";
  }
  if (!input.fecha) {
    errores.fecha = "Captura la fecha del movimiento.";
  }
  if (!input.concepto || !input.concepto.trim()) {
    errores.concepto = "Captura el concepto del movimiento.";
  }
  if (input.monto == null || Number.isNaN(input.monto) || input.monto <= 0) {
    errores.monto = "El importe debe ser mayor a cero.";
  }
  return errores;
}

export function esMovimientoManualValido(input: Partial<MovimientoManualInput>): boolean {
  return Object.keys(validarMovimientoManual(input)).length === 0;
}
