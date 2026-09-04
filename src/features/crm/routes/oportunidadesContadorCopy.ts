/**
 * Copy de contadores de /crm/oportunidades con singular/plural mexicano.
 * Agrupado con `prospectosContadorCopy` (antes: "1 oportunidades abiertas").
 */

/** "1 de 1 oportunidad" · "2 de 5 oportunidades" · "0 de 0 oportunidades" */
export function copiaContadorOportunidades(mostradas: number, total: number): string {
  return `${mostradas} de ${total} ${total === 1 ? "oportunidad" : "oportunidades"}`;
}

/** "1 oportunidad abierta" · "3 oportunidades abiertas" · "0 oportunidades abiertas" */
export function copiaOportunidadesAbiertas(cantidad: number): string {
  return cantidad === 1 ? "1 oportunidad abierta" : `${cantidad} oportunidades abiertas`;
}
