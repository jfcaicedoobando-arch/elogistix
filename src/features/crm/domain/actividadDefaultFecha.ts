/**
 * Hallazgo #13.2 (auditoría CRM) — fecha/hora default de una actividad rápida.
 *
 * Antes se calculaba "hoy 17:00" con el reloj del navegador: si el diálogo se
 * abría después de las 17:00 (o en fin de semana) la tarea nacía vencida.
 * Ahora usamos el calendario de negocio de CDMX (`src/lib/date/mx.ts`) y, si
 * ya pasó la hora límite del día (o es fin de semana), empujamos al siguiente
 * día hábil a las 9:00.
 */
import { hoyMx, horaMx, isoUtcDay, parseLocalMx } from "@/lib/date/mx";

const HORA_LIMITE_HOY = 17;
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
 * Devuelve un valor `datetime-local` (`YYYY-MM-DDTHH:mm`) con el default de
 * la actividad rápida: hoy 17:00 hora CDMX, o el siguiente día hábil 9:00 si
 * ya son las 17:00 o más tarde, o si hoy es fin de semana.
 */
export function actividadDefaultFechaMx(base: Date = new Date()): string {
  const hoy = hoyMx(base);
  const hora = horaMx(base);
  const requiereSiguienteDia = hora >= HORA_LIMITE_HOY || esFinDeSemana(hoy);
  const fecha = requiereSiguienteDia ? siguienteDiaHabil(hoy) : hoy;
  const horaDefault = requiereSiguienteDia ? HORA_DEFAULT_SIGUIENTE_DIA : HORA_LIMITE_HOY;
  return `${fecha}T${String(horaDefault).padStart(2, "0")}:00`;
}
