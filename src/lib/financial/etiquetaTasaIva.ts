/**
 * R7-FIX2 — Etiqueta de la tasa de IVA derivada de las filas reales.
 *
 * Antes la UI imprimía siempre la tasa de la organización (16%) aunque el
 * concepto tributara al 8% de frontera. Aquí se calcula la(s) tasa(s)
 * efectiva(s) de los conceptos:
 * - una sola tasa  → "8%"
 * - varias tasas   → "tasas mixtas 8/16%"
 * - ninguna con IVA → la tasa global de la organización (fallback informativo)
 */
import { resolverTasaConcepto } from "@/lib/financial/financialUtils";

export interface FilaConIva {
  aplica_iva?: boolean | null;
  tasa_iva_aplicada?: number | null;
}

/** Tasas efectivas (en %) presentes en las filas que sí causan IVA. */
export function tasasEfectivas(
  filas: ReadonlyArray<FilaConIva>,
  tasaGlobal: number,
): number[] {
  const tasas = filas
    .map((f) => resolverTasaConcepto(f, tasaGlobal))
    .filter((t) => t > 0)
    .map((t) => Math.round(t * 100));
  return [...new Set(tasas)].sort((a, b) => a - b);
}

/** Etiqueta legible en es-MX de la(s) tasa(s) de IVA de las filas. */
export function etiquetaTasaIva(
  filas: ReadonlyArray<FilaConIva>,
  tasaGlobal: number,
): string {
  const tasas = tasasEfectivas(filas, tasaGlobal);
  if (tasas.length === 0) return `${Math.round(tasaGlobal * 100)}%`;
  if (tasas.length === 1) return `${tasas[0]}%`;
  return `tasas mixtas ${tasas.join("/")}%`;
}
