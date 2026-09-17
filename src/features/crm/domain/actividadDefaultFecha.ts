/**
 * Hallazgo #13.2 / CRM-P1.1 — fecha/hora default de una actividad rápida.
 *
 * Antes se calculaba "hoy 17:00" con el reloj del navegador: si el diálogo se
 * abría después de las 17:00 (o en fin de semana) la tarea nacía vencida.
 * Un arreglo intermedio dejó "hoy 17:00" antes del corte, pero los formularios
 * prometen "mañana 9:00" / "próximo día hábil 9:00": a la 1:18 p.m. la tarea
 * aparecía para las 17:00 del MISMO día.
 *
 * Regla única (calendario CDMX, `src/lib/date/mx.ts`): SIEMPRE el siguiente
 * día hábil a las 9:00, sin importar la hora de captura.
 */
import { hoyMx, isoUtcDay, parseLocalMx } from "@/lib/date/mx";

const HORA_DEFAULT_SIGUIENTE_DIA = 9;

function esFinDeSemana(fechaIso: string): boolean {
  const dow = parseLocalMx(fechaIso).getUTCDay();
  return dow === 0 || dow === 6;
}

function siguienteDiaHabil(fechaIso: string): string {
  const d = parseLocalMx(fechaIso);
  do {
    d.setUTCDate(d.getUTCDate() + 1);
  } while (esFinDeSemana(isoUtcDay(d)));
  return isoUtcDay(d);
}

/**
 * Devuelve un valor `datetime-local` (`YYYY-MM-DDTHH:mm`) con el default de la
 * actividad rápida: siguiente día hábil a las 9:00 hora CDMX (mañana en día
 * hábil; lunes si hoy es viernes o fin de semana).
 */
export function actividadDefaultFechaMx(base: Date = new Date()): string {
  const fecha = siguienteDiaHabil(hoyMx(base));
  return `${fecha}T${String(HORA_DEFAULT_SIGUIENTE_DIA).padStart(2, "0")}:00`;
}
