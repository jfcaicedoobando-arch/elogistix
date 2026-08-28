/**
 * Ola E3 · Sub-ola C · N2 — Traslado de IVA del documento relacionado (REP).
 *
 * Antes la tasa se "adivinaba" con la proporción iva/subtotal de la factura y
 * se anclaba a la tasa del catálogo más cercana: con mezcla de tasas eso
 * timbraba un dato falso (p. ej. 16% + exento ⇒ promedio 10% ⇒ 8%).
 *
 * Ahora la tasa se toma de los renglones (`conceptos_factura`): se agrupa por
 * tasa/factor y, si hay más de un grupo con IVA trasladado, se rechaza el
 * timbrado con un mensaje claro en vez de inventar la tasa.
 */

export type FactorIvaDr = "Tasa" | "Exento";

export interface ConceptoTraslado {
  tipo_iva?: string | null;
  tasa_iva_aplicada?: number | string | null;
}

export interface TrasladoDr {
  tasa: number;
  factor: FactorIvaDr;
}

export const MSG_IVA_MULTITASA =
  "LC_REP_IVA_MULTITASA: La factura relacionada mezcla más de una tasa de IVA trasladado; " +
  "el complemento de pago no puede declararlas en un solo grupo. Emite el REP desde una factura " +
  "con tasa homogénea o reemite la factura separando las tasas.";

/** Tasas del catálogo SAT c_TasaOCuota admitidas para traslado de IVA. */
const TASAS_SAT: readonly number[] = [0, 0.08, 0.16];

function anclarTasa(valor: number): number {
  let mejor = 0;
  let distancia = Number.POSITIVE_INFINITY;
  for (const tasa of TASAS_SAT) {
    const d = Math.abs(valor - tasa);
    if (d < distancia) {
      distancia = d;
      mejor = tasa;
    }
  }
  return mejor;
}

function tasaDeConcepto(c: ConceptoTraslado): { tasa: number; factor: FactorIvaDr } {
  const tipo = String(c?.tipo_iva ?? "").trim().toLowerCase();
  if (tipo === "exento") return { tasa: 0, factor: "Exento" };
  const raw = c?.tasa_iva_aplicada;
  if (raw === null || raw === undefined || raw === "") {
    if (tipo === "gravado_8") return { tasa: 0.08, factor: "Tasa" };
    if (tipo === "tasa_0") return { tasa: 0, factor: "Tasa" };
    return { tasa: 0.16, factor: "Tasa" };
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return { tasa: 0, factor: "Tasa" };
  return { tasa: anclarTasa(n), factor: "Tasa" };
}

/**
 * Traslado a declarar en el REP.
 * - `null` ⇒ la factura mezcla tasas con IVA (el llamador responde 422).
 * - Sin renglones ⇒ se devuelve `null` para que el llamador use el respaldo
 *   histórico (facturas antiguas sin conceptos capturados).
 */
export function resolverTrasladoDr(
  conceptos: ConceptoTraslado[] | null | undefined,
): TrasladoDr | null | "sin_conceptos" {
  const lista = conceptos ?? [];
  if (lista.length === 0) return "sin_conceptos";

  const grupos = new Set<string>();
  let exentos = 0;
  let tasaCero = 0;
  for (const c of lista) {
    const { tasa, factor } = tasaDeConcepto(c);
    if (factor === "Exento") { exentos += 1; continue; }
    if (tasa === 0) { tasaCero += 1; continue; }
    grupos.add(tasa.toFixed(6));
  }

  if (grupos.size > 1) return null;
  if (grupos.size === 1) return { tasa: Number([...grupos][0]), factor: "Tasa" };
  if (exentos > 0 && tasaCero === 0) return { tasa: 0, factor: "Exento" };
  return { tasa: 0, factor: "Tasa" };
}
