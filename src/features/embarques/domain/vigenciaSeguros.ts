import { diffDiasCalendario } from "@/lib/date/dateOnly";
import { todayLocalISO } from "@/lib/date/today";

export function diasRestantesSeguro(hasta: string, hoy = todayLocalISO()): number {
  return diffDiasCalendario(hoy, hasta);
}

/** Vencida y por vencer son categorías disjuntas sobre el mismo día civil. */
export function contarVigenciasSeguros(seguros: { vigencia_hasta: string; deleted_at?: string | null }[], hoy = todayLocalISO()) {
  let vencidas = 0;
  let porVencer = 0;
  for (const seguro of seguros) {
    if (seguro.deleted_at) continue;
    const dias = diasRestantesSeguro(seguro.vigencia_hasta, hoy);
    if (dias < 0) vencidas++;
    else if (dias <= 7) porVencer++;
  }
  return { vencidas, porVencer };
}
