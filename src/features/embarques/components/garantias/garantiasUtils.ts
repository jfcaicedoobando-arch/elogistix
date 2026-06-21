/** Diferencia en días entre dos fechas ISO (YYYY-MM-DD). */
export function diffDias(desdeIso: string, hastaIso: string): number {
  const a = new Date(desdeIso + "T00:00:00").getTime();
  const b = new Date(hastaIso + "T00:00:00").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}
