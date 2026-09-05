/**
 * Lógica pura para `useProximasActividades`: agrupa filas ya ordenadas
 * por `fecha_programada` y devuelve la primera por entidad.
 */
import { diffDiasMx } from "@/lib/date/mx";

export interface ActividadRowLite<T extends string = string> {
  id: string;
  entidad_id: string;
  entidad_tipo: T;
  fecha_programada: string | null;
  tipo: string;
  asunto: string;
}

export function buildProximasMap<T extends ActividadRowLite>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (!map.has(row.entidad_id)) map.set(row.entidad_id, row);
  }
  return map;
}

/** "Vencida" si la fecha es anterior a hoy en el calendario de negocio (CDMX). */
export function esVencida(fecha: string | null, now: Date = new Date()): boolean {
  const diff = diffDiasMx(now, fecha);
  return diff !== null && diff < 0;
}

/** "Hoy" si la fecha cae en el mismo día calendario CDMX. */
export function esHoy(fecha: string | null, now: Date = new Date()): boolean {
  return diffDiasMx(now, fecha) === 0;
}
