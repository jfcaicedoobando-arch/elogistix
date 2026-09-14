/**
 * Helpers para el formulario de datos fiscales de una factura borrador.
 * v13.171.0 — `tipoCambio` puede ser `null` mientras el usuario captura.
 *   Las facturas USD/EUR nacen sin TC (null) y el timbrado se bloquea hasta
 *   que el usuario lo capture o pulse "Obtener TC DOF de hoy".
 * v13.164.3 — se removió `serie`: FacturAPI es la fuente de verdad para
 * serie y folio; enviar un hint manual solo introduce riesgo de mismatch.
 */
import type { FacturaDetalle } from "@/features/facturacion/hooks";
import type { DatosTimbradoPatch } from "@/features/facturacion/services";
import { tcValido } from "@/lib/financial/tcValido";
import { validarTcMxn } from "@/lib/financial/tcBanda";

/**
 * B12 — Aviso de tipo de cambio para el borrador en moneda extranjera.
 * Devuelve `null` cuando el T/C sirve para timbrar; si falta o está fuera de la
 * banda de plausibilidad (5..40 pesos por divisa, el mismo candado que aplica
 * la base al timbrar), regresa el texto de la advertencia.
 */
export function avisoTipoCambioFactura(
  moneda: string | null | undefined,
  tipoCambio: number | null | undefined,
): string | null {
  if (moneda === "MXN") return null;
  if (tcValido(tipoCambio) == null) {
    return "Falta capturar el tipo de cambio del día. Pulsa “Obtener TC DOF de hoy” o escríbelo manualmente antes de timbrar.";
  }
  const fueraDeBanda = validarTcMxn(tipoCambio);
  if (fueraDeBanda) {
    return `${fueraDeBanda} Corrígelo antes de timbrar: el sistema rechazará la factura con este valor.`;
  }
  return null;
}

export interface DatosFiscalesEstado {
  usoCfdi: string;
  formaPago: string;
  metodoPago: string;
  diasCredito: number;
  tipoCambio: number | null;
  notas: string;
}

export function inicialesDatosFiscales(factura: FacturaDetalle): DatosFiscalesEstado {
  const tcRaw = factura.tipo_cambio == null ? null : Number(factura.tipo_cambio);
  return {
    usoCfdi: factura.uso_cfdi ?? "G03",
    formaPago: factura.forma_pago ?? "99",
    metodoPago: factura.metodo_pago ?? "PPD",
    diasCredito: factura.dias_credito ?? 0,
    tipoCambio: tcRaw && tcRaw > 0 ? tcRaw : null,
    notas: factura.notas ?? "",
  };
}

export function buildDatosTimbradoPatch(
  estado: DatosFiscalesEstado,
  moneda: string | null | undefined,
): DatosTimbradoPatch {
  const notasClean = estado.notas.trim();
  // MXN siempre 1; extranjera: null si el usuario aún no lo capturó.
  const tcExtranjera =
    estado.tipoCambio != null && estado.tipoCambio > 0 ? estado.tipoCambio : null;
  return {
    uso_cfdi: estado.usoCfdi,
    forma_pago: estado.formaPago,
    metodo_pago: estado.metodoPago,
    dias_credito: Math.max(0, Math.round(estado.diasCredito)),
    notas: notasClean ? notasClean : null,
    tipo_cambio: moneda === "MXN" ? 1 : tcExtranjera,
  };
}
