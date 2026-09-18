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
import { roundMoney } from "@/lib/financial/financialUtils";
import type { ConceptoNotaCredito } from "@/features/facturacion/services/notasCredito";
import {
  claveTratamientoNC,
  factorTotalNC,
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
  const escalados = lineas.map((c) => ({
    ...c,
    precio_unitario: roundMoney(Number(c.precio_unitario ?? 0) * factor),
  }));
  // Ajuste de centavos en el último renglón para que el total cuadre exacto.
  const ultimo = escalados.length - 1;
  const diferencia = roundMoney(saldo - calcularTotalesNC(escalados).total);
  const cantidad = Number(escalados[ultimo].cantidad ?? 1) || 1;
  const factorLinea = factorTotalNC(escalados[ultimo]);
  if (diferencia !== 0 && factorLinea > 0) {
    escalados[ultimo] = {
      ...escalados[ultimo],
      precio_unitario: roundMoney(
        Number(escalados[ultimo].precio_unitario ?? 0) + diferencia / (cantidad * factorLinea),
      ),
    };
  }
  return escalados;
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
    return { ok: true, conceptos: [conceptoPorSaldo(saldo, base)] };
  }
  if (lineas.some(lineaIndeterminadaNC)) {
    return { ok: false, motivo: MOTIVO_TRATAMIENTO_INDEFINIDO };
  }
  const claves = new Set(lineas.map(claveTratamientoNC));
  if (claves.size === 1) return { ok: true, conceptos: [conceptoPorSaldo(saldo, lineas[0])] };
  if (calcularTotalesNC(lineas).total <= 0) return { ok: false, motivo: MOTIVO_IMPORTES_CERO };
  return { ok: true, conceptos: prorratear(saldo, lineas) };
}
