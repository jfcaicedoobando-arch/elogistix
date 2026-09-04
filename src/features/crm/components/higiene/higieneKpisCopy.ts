/**
 * Copy singular/plural para el KPI de oportunidades completas del tablero de
 * Higiene. v13.823.77 — antes decía "1 de 1 oportunidades completas".
 */
export function copiaOportunidadesCompletas(completos: number, abiertas: number): string {
  const sustantivo = abiertas === 1 ? "oportunidad completa" : "oportunidades completas";
  return `${completos} de ${abiertas} ${sustantivo}`;
}
