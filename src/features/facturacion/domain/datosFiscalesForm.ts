/**
 * Helpers para el formulario de datos fiscales de una factura borrador.
 * Extraídos para reducir la complejidad ciclomática de
 * `FacturaDatosFiscalesCard`.
 */
import type { FacturaDetalle } from "@/features/facturacion/hooks";
import type { DatosTimbradoPatch } from "@/features/facturacion/services";

export interface DatosFiscalesEstado {
  serie: string;
  usoCfdi: string;
  formaPago: string;
  metodoPago: string;
  diasCredito: number;
  tipoCambio: number;
  notas: string;
}

export function inicialesDatosFiscales(factura: FacturaDetalle): DatosFiscalesEstado {
  return {
    serie: factura.serie ?? "A",
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
    serie: estado.serie.toUpperCase().slice(0, 5),
    uso_cfdi: estado.usoCfdi,
    forma_pago: estado.formaPago,
    metodo_pago: estado.metodoPago,
    dias_credito: Math.max(0, Math.round(estado.diasCredito)),
    notas: notasClean ? notasClean : null,
    tipo_cambio: moneda === "MXN" ? 1 : tipoCambioSeguro,
  };
}
