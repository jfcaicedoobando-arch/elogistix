/**
 * Validaciones puras del pago a proveedor (montos, IVA y totales).
 *
 * Objetivo: que nada incoherente llegue a la BD. Se separan dos niveles:
 *  - `error`: bloquea el guardado (primer error encontrado).
 *  - `avisos`: incoherencias informativas que no bloquean (p. ej. IVA raro).
 *
 * Módulo puro (sin Supabase) para poder cubrirlo con pruebas unitarias.
 * Las reglas individuales y los avisos viven en archivos hermanos.
 */
import {
  validarMonto,
  validarFechas,
  validarTipoCambio,
  validarCuenta,
  validarDiferenciaCambiaria,
} from "./pagoProveedorReglas";
import { calcularAvisosPago } from "./pagoProveedorAvisos";

export { calcularAvisosPago } from "./pagoProveedorAvisos";
export interface CuentaPagoInfo {
  id: string;
  moneda: string;
  banco?: string | null;
  alias?: string | null;
}

export interface FacturaPagoInfo {
  moneda: string;
  saldo: number;
  total: number;
  subtotal: number;
  iva: number;
  ieps: number;
  retenciones: number;
  fecha_emision: string;
  estado_aprobacion: "pendiente" | "aprobada" | "rechazada";
}

export interface ValidarPagoInput {
  factura: FacturaPagoInfo | null | undefined;
  /** Fecha del pago en formato ISO corto (YYYY-MM-DD). */
  fecha: string;
  /** Fecha de hoy (ISO corto) para no depender del reloj dentro del módulo. */
  hoy: string;
  /** Monto capturado tal cual (texto del input). */
  montoTexto: string;
  monto: number;
  /** Monto convertido a la moneda de la factura. */
  montoEnMonedaFactura: number;
  moneda: string;
  /** TC ya validado (> 0) o `null`. */
  tcNum: number | null;
  bloqueadoPorTc: boolean;
  requiereCuenta: boolean;
  cuenta: CuentaPagoInfo | null;
  /** Diferencia cambiaria capturada (texto vacío = no aplica). */
  diffMxnTexto: string;
  esUsdPagadoEnMxn: boolean;
  /** "crear" (default) o "editar" un pago ya registrado. */
  modo?: "crear" | "editar";
  /**
   * Sólo en modo "editar": monto del pago original expresado en la moneda de
   * la factura. Se devuelve al saldo antes de validar, porque al editar ese
   * importe deja de estar aplicado.
   */
  montoOriginalEnMonedaFactura?: number;
}


export interface ResultadoValidacionPago {
  error: string | null;
  avisos: string[];
}

const TOLERANCIA = 0.01;
/** Tolerancia de redondeo para el cuadre de totales de la factura. */
const TOLERANCIA_TOTALES = 0.05;
/** Cota superior de tipo de cambio aceptada en capturas (pagos, facturas, anticipos). */
export const TC_MAX = 1000;

/** ¿El texto tiene más de 2 decimales? (los centavos son el límite fiscal). */
export function tieneMasDeDosDecimales(texto: string): boolean {
  const decimales = texto.trim().split(".")[1];
  return !!decimales && decimales.replace(/0+$/, "").length > 2;
}

/**
 * Cuadre de la factura: subtotal + IVA + IEPS − retenciones ≈ total.
 * Devuelve la diferencia (0 cuando cuadra dentro de la tolerancia).
 */
export function descuadreTotalesFactura(f: FacturaPagoInfo): number {
  const calculado = f.subtotal + f.iva + f.ieps - f.retenciones;
  const dif = calculado - f.total;
  return Math.abs(dif) <= TOLERANCIA_TOTALES ? 0 : dif;
}

/**
 * Saldo contra el que se valida el monto. Al editar, el importe del pago
 * original vuelve al saldo (ya no está aplicado).
 */
export function saldoDisponiblePago(a: ValidarPagoInput): number {
  const saldo = a.factura?.saldo ?? 0;
  if (a.modo !== "editar") return saldo;
  return saldo + (a.montoOriginalEnMonedaFactura ?? 0);
}

/** Errores que bloquean el guardado, en orden de prioridad. */
export function validarPagoProveedor(a: ValidarPagoInput): ResultadoValidacionPago {
  const avisos = calcularAvisosPago(a);
  const factura = a.factura;
  if (!factura) return { error: "Factura no disponible", avisos };
  if (factura.estado_aprobacion !== "aprobada") {
    return { error: "La factura debe estar aprobada antes de registrar pagos", avisos };
  }
  const disponible = saldoDisponiblePago(a);
  if (disponible <= 0) {
    return { error: "La factura no tiene saldo pendiente", avisos };
  }
  // EC-12: un residuo de redondeo (≤ $0.01) ya no es pagable con el flujo
  // normal (el prefill y el guard de BD operan a centavos) y dejaba la
  // factura eternamente abierta en aging. Se bloquea el pago y se dirige al
  // cierre explícito existente ("Cerrar sin pago" en el detalle), que marca
  // la factura como pagada con motivo de ajuste.
  if (disponible <= TOLERANCIA) {
    return {
      error:
        "La factura sólo tiene un residuo de redondeo (≤ $0.01). " +
        "Ciérrala con «Cerrar sin pago» desde el detalle para marcarla como pagada.",
      avisos,
    };
  }
  const error =
    validarMonto(a) ??
    validarFechas(a) ??
    validarTipoCambio(a, factura) ??
    validarCuenta(a) ??
    validarDiferenciaCambiaria(a) ??
    (a.montoEnMonedaFactura > disponible + TOLERANCIA
      ? `El monto excede el saldo pendiente (${factura.moneda})`
      : null);
  return { error, avisos };
}
