/**
 * Lógica pura para `useProximasActividades`: agrupa filas ya ordenadas
 * por `fecha_programada` y devuelve la primera por entidad.
 */

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

/** "Vencida" si la fecha es anterior a `now` (sin hora). */
export function esVencida(fecha: string | null, now: Date = new Date()): boolean {
  if (!fecha) return false;
  const f = new Date(fecha);
  if (Number.isNaN(f.getTime())) return false;
  // Comparar por día local — vencida sólo si f < hoy.
  const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fDia = new Date(f.getFullYear(), f.getMonth(), f.getDate());
  return fDia < hoy;
}

/** "Hoy" si la fecha cae en el mismo día calendario. */
export function esHoy(fecha: string | null, now: Date = new Date()): boolean {
  if (!fecha) return false;
  const f = new Date(fecha);
  if (Number.isNaN(f.getTime())) return false;
  return (
    f.getFullYear() === now.getFullYear() &&
    f.getMonth() === now.getMonth() &&
    f.getDate() === now.getDate()
  );
}
