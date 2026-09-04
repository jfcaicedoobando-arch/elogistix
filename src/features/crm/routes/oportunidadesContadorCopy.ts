/**
 * Copy de contadores de /crm/oportunidades con singular/plural mexicano.
 * Agrupado con `prospectosContadorCopy` (antes: "1 oportunidades abiertas").
 */
import { pluralS } from "@/lib/formatters";

/** "1 de 1 oportunidad" · "2 de 5 oportunidades" · "0 de 0 oportunidades" */
export function copiaContadorOportunidades(mostradas: number, total: number): string {
  return `${mostradas} de ${total} oportunidad${pluralS(total)}`;
}

/** "1 oportunidad abierta" · "3 oportunidades abiertas" · "0 oportunidades abiertas" */
export function copiaOportunidadesAbiertas(cantidad: number): string {
  const s = pluralS(cantidad);
  return `${cantidad} oportunidad${s} abierta${s}`;
}
