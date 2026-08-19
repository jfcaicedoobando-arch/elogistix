import { diffDiasCalendario } from "@/lib/date/dateOnly";

/**
 * Diferencia en días entre dos fechas ISO (YYYY-MM-DD).
 * Delega en el helper único de calendario (Ola 19 · paso 1).
 */
export function diffDias(desdeIso: string, hastaIso: string): number {
  return diffDiasCalendario(desdeIso, hastaIso);
}
