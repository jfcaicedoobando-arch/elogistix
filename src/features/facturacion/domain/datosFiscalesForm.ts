/**
 * Helpers para el formulario de datos fiscales de una factura borrador.
 * v13.164.3 — se removió `serie`: FacturAPI es la fuente de verdad para
 * serie y folio; enviar un hint manual solo introduce riesgo de mismatch.
 */
import type { FacturaDetalle } from "@/features/facturacion/hooks";
import type { DatosTimbradoPatch } from "@/features/facturacion/services";

export interface DatosFiscalesEstado {
  usoCfdi: string;
  formaPago: string;
  metodoPago: string;
  diasCredito: number;
  tipoCambio: number;
  notas: string;
}

export function inicialesDatosFiscales(factura: FacturaDetalle): DatosFiscalesEstado {
  return {
    usoCfdi: factura.uso_cfdi ?? "G03",
    formaPago: factura.forma_pago ?? "03",
    metodoPago: factura.metodo_pago ?? "PUE",
    diasCredito: factura.dias_credito ?? 0,
    tipoCambio: Number(factura.tipo_cambio ?? 1),
    notas: factura.notas ?? "",
  };
}

export function buildDatosTimbradoPatch(
  estado: DatosFiscalesEstado,
  moneda: string | null | undefined,
): DatosTimbradoPatch {
  const notasClean = estado.notas.trim();
  const tipoCambioSeguro = Math.max(0, Number(estado.tipoCambio) || 1);
  return {
    uso_cfdi: estado.usoCfdi,
    forma_pago: estado.formaPago,
    metodo_pago: estado.metodoPago,
    dias_credito: Math.max(0, Math.round(estado.diasCredito)),
    notas: notasClean ? notasClean : null,
    tipo_cambio: moneda === "MXN" ? 1 : tipoCambioSeguro,
  };
}
