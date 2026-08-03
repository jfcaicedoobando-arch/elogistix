/**
 * Detalles de bitácora para movimientos de tesorería de pagos a proveedor (R6-N2).
 * Módulo puro: sólo construye el objeto `detalles` que se guarda en
 * `bitacora_actividad`, sin tocar Supabase.
 */
import { cargoEnMxn } from "./pagoProveedorMovimiento";
import type { PagoProveedor } from "./pagosProveedorTypes";

export type EstadoMovimientoTesoreria = "creado" | "no_creado" | "sin_cuenta" | "dado_de_baja";

export interface DetallesPagoRegistradoInput {
  pagoId: string;
  monto: number;
  moneda: PagoProveedor["moneda"];
  metodoPago: string;
  referencia?: string;
  cuentaBancariaId?: string | null;
  tipoCambioUsd: number | null;
  movimientoCreado: boolean;
}

export function detallesPagoRegistrado(input: DetallesPagoRegistradoInput) {
  const conCuenta = Boolean(input.cuentaBancariaId);
  const movimiento: EstadoMovimientoTesoreria = conCuenta
    ? input.movimientoCreado
      ? "creado"
      : "no_creado"
    : "sin_cuenta";
  return {
    pago_id: input.pagoId,
    monto: input.monto,
    moneda: input.moneda,
    metodo_pago: input.metodoPago,
    referencia: input.referencia ?? null,
    cuenta_bancaria_id: input.cuentaBancariaId ?? null,
    cargo_mxn: conCuenta ? cargoEnMxn(input.monto, input.moneda, input.tipoCambioUsd) : null,
    movimiento_tesoreria: movimiento,
  };
}

export function detallesPagoEliminado(pagoId: string, userId: string | null) {
  return {
    pago_id: pagoId,
    deleted_by: userId,
    movimiento_tesoreria: "dado_de_baja" as EstadoMovimientoTesoreria,
  };
}

export interface DetallesPagoEditadoInput extends DetallesPagoRegistradoInput {
  montoAnterior: number;
  monedaAnterior: PagoProveedor["moneda"];
  cuentaAnteriorId: string | null;
}

/** Detalles del pago editado: incluye el "antes" para poder auditar el cambio. */
export function detallesPagoEditado(input: DetallesPagoEditadoInput) {
  return {
    ...detallesPagoRegistrado(input),
    monto_anterior: input.montoAnterior,
    moneda_anterior: input.monedaAnterior,
    cuenta_anterior_id: input.cuentaAnteriorId,
  };
}
