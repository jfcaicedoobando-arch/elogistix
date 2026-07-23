/**
 * Hoja pura para romper el ciclo `ejecutivoAgregados` ↔ `ejecutivoRanking`.
 * Contiene constantes y helpers sin imports internos del dominio.
 * Sprint 2 · ítem 2.4.
 */
export const TOP_N = 5;

export function diffHoras(desde: string, hasta: string): number {
  return (Date.parse(hasta) - Date.parse(desde)) / (1000 * 60 * 60);
}
