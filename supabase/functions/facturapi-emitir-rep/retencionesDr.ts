/**
 * Ola 12 · R3P-19 — retenciones del CFDI relacionado para el REP.
 *
 * `conceptos_factura` guarda las retenciones por renglón (`tasa_ret_isr`,
 * `tasa_ret_iva`). El complemento de pagos las declara como `RetencionesDR`
 * con UNA tasa por impuesto; si la factura mezcla tasas distintas del mismo
 * impuesto no hay forma de desglosarlas y el timbrado se bloquea.
 */

export interface ConceptoRetencion {
  tasa_ret_isr?: number | string | null;
  tasa_ret_iva?: number | string | null;
}

export interface RetencionDr { tipo: "IVA" | "ISR"; tasa: number }

export const MSG_RETENCIONES_NO_SOPORTADAS =
  "LC_REP_RETENCIONES_NO_SOPORTADAS: La factura relacionada tiene retenciones con más de una tasa por impuesto; el REP no puede desglosarlas. Reemite la factura con tasas homogéneas o timbra el complemento por fuera.";

function tasasUnicas(conceptos: ConceptoRetencion[], campo: "tasa_ret_isr" | "tasa_ret_iva"): number[] {
  const tasas = conceptos
    .map((c) => Number(c?.[campo] ?? 0))
    .filter((t) => Number.isFinite(t) && t > 0);
  return [...new Set(tasas)];
}

/**
 * Devuelve las retenciones a declarar, o `null` cuando hay más de una tasa por
 * impuesto (el llamador responde 422 con MSG_RETENCIONES_NO_SOPORTADAS).
 */
export function calcularRetencionesDr(conceptos: ConceptoRetencion[] | null | undefined): RetencionDr[] | null {
  const lista = conceptos ?? [];
  const isr = tasasUnicas(lista, "tasa_ret_isr");
  const iva = tasasUnicas(lista, "tasa_ret_iva");
  if (isr.length > 1 || iva.length > 1) return null;
  return [
    ...isr.map((tasa) => ({ tipo: "ISR" as const, tasa })),
    ...iva.map((tasa) => ({ tipo: "IVA" as const, tasa })),
  ];
}
