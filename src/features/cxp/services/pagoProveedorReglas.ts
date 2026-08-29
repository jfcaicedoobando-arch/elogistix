/**
 * Reglas individuales de validación de un pago a proveedor.
 * Extraído de pagoProveedorValidaciones.ts para respetar el límite de líneas.
 */
import type { ValidarPagoInput, FacturaPagoInfo } from "./pagoProveedorValidaciones";
import { tieneMasDeDosDecimales, TC_MAX } from "./pagoProveedorValidaciones";
import { parInvolucraMxn, validarTcMxn } from "@/lib/financial/tcBanda";

const TC_MIN = 0.01;

export function validarMonto(a: ValidarPagoInput): string | null {
  if (!Number.isFinite(a.monto)) return "Captura un monto numérico válido";
  if (a.monto <= 0) return "El monto debe ser mayor a 0";
  if (tieneMasDeDosDecimales(a.montoTexto)) {
    return "El monto no puede tener más de 2 decimales";
  }
  return null;
}

export function validarFechas(a: ValidarPagoInput): string | null {
  if (!a.fecha) return "Captura la fecha del pago";
  if (a.fecha > a.hoy) return "La fecha del pago no puede ser futura";
  if (a.factura?.fecha_emision && a.fecha < a.factura.fecha_emision) {
    return "La fecha del pago no puede ser anterior a la fecha de emisión de la factura";
  }
  return null;
}

export function validarTipoCambio(a: ValidarPagoInput, factura: FacturaPagoInfo): string | null {
  if (a.bloqueadoPorTc) {
    return `Captura un tipo de cambio válido para pagar en MXN una factura ${factura.moneda}`;
  }
  if (a.tcNum !== null && (a.tcNum < TC_MIN || a.tcNum > TC_MAX)) {
    return `El tipo de cambio debe estar entre ${TC_MIN} y ${TC_MAX}`;
  }
  // M-14 (re-fix v15): cuando el par involucra MXN el T/C son pesos por
  // divisa, así que aplica la banda de plausibilidad (5-40). Atrapa dedazos
  // tipo 1.85 o 185 antes de que contaminen el P&L.
  if (a.tcNum !== null && parInvolucraMxn(a.moneda, factura.moneda)) {
    const fueraDeBanda = validarTcMxn(a.tcNum);
    if (fueraDeBanda) return fueraDeBanda;
  }
  return null;
}

export function validarCuenta(a: ValidarPagoInput): string | null {
  if (a.requiereCuenta && !a.cuenta) {
    return "Selecciona la cuenta bancaria de donde sale el pago";
  }
  if (a.cuenta && a.cuenta.moneda !== a.moneda) {
    return `La cuenta seleccionada es en ${a.cuenta.moneda} y el pago es en ${a.moneda}`;
  }
  return null;
}

export function validarDiferenciaCambiaria(a: ValidarPagoInput): string | null {
  if (!a.esUsdPagadoEnMxn || a.diffMxnTexto.trim() === "") return null;
  const diff = Number(a.diffMxnTexto);
  if (!Number.isFinite(diff)) return "La diferencia cambiaria debe ser numérica";
  if (tieneMasDeDosDecimales(a.diffMxnTexto)) {
    return "La diferencia cambiaria no puede tener más de 2 decimales";
  }
  if (Math.abs(diff) > Math.abs(a.monto)) {
    return "La diferencia cambiaria no puede ser mayor que el monto del pago";
  }
  return null;
}
