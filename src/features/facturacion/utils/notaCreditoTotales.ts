/**
 * Totales de una nota de crédito. Se calcula por línea con el motor canónico
 * antes de sumar (B-007 / M3): el flotante crudo dejaba centavos fantasma en
 * el saldo o rechazaba NCs legítimas por epsilon.
 *
 * P1-IVA — el IVA sale del tratamiento fiscal del renglón (16%, 8%, tasa 0,
 * exento o no objeto) con la misma regla del payload SAT, y las retenciones
 * ISR/IVA del renglón original se reversan restando del total.
 */
import { sumarMontos } from "@/lib/financial/financialUtils";
import { impuestosLineaNC } from "@/features/facturacion/utils/impuestosNotaCredito";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";

export interface TotalesNC {
  subtotal: number;
  iva: number;
  /** Retención de ISR reversada (resta del total). */
  retIsr: number;
  /** Retención de IVA reversada (resta del total). */
  retIva: number;
  total: number;
}

export function calcularTotalesNC(conceptos: ConceptoNotaCredito[]): TotalesNC {
  const lineas = conceptos.map((c) => impuestosLineaNC(c));
  return {
    subtotal: sumarMontos(lineas.map((l) => l.base)),
    iva: sumarMontos(lineas.map((l) => l.iva)),
    retIsr: sumarMontos(lineas.map((l) => l.retIsr)),
    retIva: sumarMontos(lineas.map((l) => l.retIva)),
    total: sumarMontos(lineas.map((l) => l.total)),
  };
}
