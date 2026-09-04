/**
 * Copy del contador de /crm/leads con singular/plural mexicano.
 * Antes decía "1 leads en cartera".
 */
import { pluralS } from "@/lib/formatters";

export function copiaContadorLeads(count: number, conFiltros: boolean): string {
  const sustantivo = `${count} lead${pluralS(count)}`;
  if (conFiltros) return `${sustantivo} ${count === 1 ? "coincide" : "coinciden"} con los filtros`;
  return `${sustantivo} en cartera`;
}
