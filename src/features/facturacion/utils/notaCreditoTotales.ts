/**
 * Totales de una nota de crédito. Se calcula por línea con el motor canónico
 * antes de sumar (B-007 / M3): el flotante crudo dejaba centavos fantasma en
 * el saldo o rechazaba NCs legítimas por epsilon.
 */
import {
  sumarMontos,
  subtotalLinea,
  calcularIVA,
  calcularTotalConIVA,
} from "@/lib/financial/financialUtils";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";

export interface TotalesNC {
  subtotal: number;
  iva: number;
  total: number;
}

function tasaSegura(c: ConceptoNotaCredito): number {
  const t = Number(c.tasa_iva);
  return Number.isFinite(t) ? t : 0;
}

export function calcularTotalesNC(conceptos: ConceptoNotaCredito[]): TotalesNC {
  const bases = conceptos.map((c) => subtotalLinea(Number(c.cantidad), Number(c.precio_unitario)));
  const subtotal = sumarMontos(bases);
  const iva = sumarMontos(conceptos.map((c, i) => calcularIVA(bases[i], tasaSegura(c))));
  const total = sumarMontos(conceptos.map((c, i) => calcularTotalConIVA(bases[i], tasaSegura(c))));
  return { subtotal, iva, total };
}
