/**
 * Edición en memoria de los conceptos extraídos por IA de un PDF (v13.823.21).
 *
 * Sólo aplica al origen `pdf_ia`: ese desglose lo propone un modelo y puede
 * traer renglones de más. El desglose que viene de un XML CFDI NO se toca
 * (garantía fiscal), por eso estas funciones no se usan en ese flujo.
 */
import type { CfdiConceptoParsed } from "@/features/cxp/services";

/** Devuelve la lista con el renglón `idx` parchado (sin mutar la original). */
export function editarConceptoIa(
  conceptos: ReadonlyArray<CfdiConceptoParsed>,
  idx: number,
  patch: Partial<CfdiConceptoParsed>,
): CfdiConceptoParsed[] {
  if (idx < 0 || idx >= conceptos.length) return [...conceptos];
  return conceptos.map((c, i) => (i === idx ? { ...c, ...patch } : c));
}

/** Devuelve la lista sin el renglón `idx` (sin mutar la original). */
export function eliminarConceptoIa(
  conceptos: ReadonlyArray<CfdiConceptoParsed>,
  idx: number,
): CfdiConceptoParsed[] {
  if (idx < 0 || idx >= conceptos.length) return [...conceptos];
  return conceptos.filter((_, i) => i !== idx);
}
