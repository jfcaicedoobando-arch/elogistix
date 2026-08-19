/**
 * Escala de severidad por días vencidos.
 *
 * v13.682.0 · UI-2 — delega en el catálogo único `@/lib/aging/buckets`, para
 * que Cobranza, Tesorería, CxC y CxP usen los MISMOS cortes (1-30 / 31-60 /
 * 61-90 / +90) y los mismos tokens de color.
 */
import {
  AGING_TEXT_CLASS,
  nivelAgingDeDias,
  type NivelAging,
} from "@/lib/aging/buckets";

export function agingNivel(dias?: number | null): NivelAging {
  return nivelAgingDeDias(dias ?? 0);
}

/** Clase de color de texto para los días vencidos. */
export function agingTextClass(dias?: number | null): string {
  return AGING_TEXT_CLASS[agingNivel(dias)];
}
