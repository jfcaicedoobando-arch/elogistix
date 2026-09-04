/**
 * Copy del contador de /crm/prospectos con singular/plural mexicano.
 * v13.823.77 — antes decía "1 prospectos en el embudo".
 */
import { pluralS } from "@/lib/formatters";

export function copiaContadorProspectos(count: number, conFiltros: boolean): string {
  const sustantivo = `${count} prospecto${pluralS(count)}`;
  if (conFiltros) return `${sustantivo} ${count === 1 ? "coincide" : "coinciden"} con los filtros`;
  return `${sustantivo} en el embudo`;
}
