/**
 * P1-IVA — Atajo "por el saldo completo" sin colapsar tratamientos fiscales.
 *
 * Antes el atajo generaba UN solo renglón gravado al 16% aunque la factura
 * mezclara 16%, 8%, tasa 0, exento y no objeto: el CFDI de egreso acreditaba
 * impuestos que la factura nunca trasladó.
 *
 * Ahora:
 *  - factura homogénea ⇒ un renglón con ese mismo tratamiento;
 *  - factura mixta ⇒ se prorratea el saldo entre los renglones originales,
 *    cada uno conservando su tratamiento, tasa y retenciones;
 *  - si algún renglón no tiene tratamiento representable ⇒ NO se genera nada y
 *    se devuelve el motivo para mostrarlo al usuario.
 */
import { ajustarSaldoFiscalNC } from "./ajustarSaldoFiscalNC";
import { impuestosLineaNC } from "./impuestosNotaCredito";
import { roundMoney } from "@/lib/financial/financialUtils";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";
import {
  claveTratamientoNC,
  lineaIndeterminadaNC,
} from "@/features/facturacion/utils/impuestosNotaCredito";
import { calcularTotalesNC } from "@/features/facturacion/utils/notaCreditoTotales";
import { conceptoPorSaldo } from "@/features/facturacion/utils/notaCreditoSugerencias";

export type ResultadoSaldoCompleto =
  | { ok: true; conceptos: ConceptoNotaCredito[] }
  | { ok: false; motivo: string };

export const MOTIVO_SALDO_INVALIDO =
  "El saldo de la factura no es válido para acreditarlo completo. Refresca la factura e inténtalo de nuevo.";

export const MOTIVO_TRATAMIENTO_INDEFINIDO =
  "La factura original tiene renglones sin tratamiento fiscal de IVA definido (no se sabe si son " +
  "gravados, exentos, a tasa 0% o no objeto). Defínelo en la factura antes de acreditar el saldo " +
  "completo: la nota de crédito debe reversar exactamente los mismos impuestos.";

export const MOTIVO_IMPORTES_CERO =
  "Los renglones de la factura original suman cero: captura manualmente los conceptos de la nota de crédito.";

/**
 * Escala cada renglón para que la suma de totales iguale `saldo`, conservando
 * el tratamiento fiscal de cada uno.
 */
function prorratear(saldo: number, lineas: ConceptoNotaCredito[]): ConceptoNotaCredito[] {
  const totalOriginal = calcularTotalesNC(lineas).total;
  const factor = saldo / totalOriginal;
  // La NC acredita importes, no unidades entregadas. Cantidad 1 evita perder
  // centavos al volver a redondear un precio dividido entre 100 o 1 000 000.
  return lineas.map((c) => ({ ...c, cantidad: 1,
    precio_unitario: roundMoney(impuestosLineaNC(c).base * factor),
  }));
}

export const MOTIVO_CUADRE_FISCAL =
  "No se puede representar el saldo exacto con estos impuestos y redondeos. Captura los conceptos manualmente; no se aplicó el atajo.";

function resultadoExacto(saldo: number, conceptos: ConceptoNotaCredito[]): ResultadoSaldoCompleto {
  const ajustados = ajustarSaldoFiscalNC(saldo, conceptos);
  if (!ajustados || calcularTotalesNC(ajustados).total !== roundMoney(saldo)) {
    return { ok: false, motivo: MOTIVO_CUADRE_FISCAL };
  }
  return { ok: true, conceptos: ajustados };
}

export function conceptosPorSaldoCompleto(
  saldo: number,
  sugeridos: ConceptoNotaCredito[],
  base: ConceptoNotaCredito,
): ResultadoSaldoCompleto {
  if (!Number.isFinite(saldo) || saldo <= 0) return { ok: false, motivo: MOTIVO_SALDO_INVALIDO };
  const lineas = sugeridos.filter((c) => Number(c.precio_unitario ?? 0) !== 0);
  if (lineas.length === 0) {
    if (lineaIndeterminadaNC(base)) return { ok: false, motivo: MOTIVO_TRATAMIENTO_INDEFINIDO };
    return resultadoExacto(saldo, [conceptoPorSaldo(saldo, base)]);
  }
  if (lineas.some(lineaIndeterminadaNC)) {
    return { ok: false, motivo: MOTIVO_TRATAMIENTO_INDEFINIDO };
  }
  const claves = new Set(lineas.map(claveTratamientoNC));
  if (claves.size === 1) return resultadoExacto(saldo, [conceptoPorSaldo(saldo, lineas[0])]);
  if (calcularTotalesNC(lineas).total <= 0) return { ok: false, motivo: MOTIVO_IMPORTES_CERO };
  return resultadoExacto(saldo, prorratear(saldo, lineas));
}
