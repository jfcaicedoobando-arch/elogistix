/**
 * Reglas puras del dominio Auditoría operativa.
 *
 * Funciones sin dependencias de React/Supabase para que puedan ser testeadas
 * aisladamente y reutilizadas tanto en hooks/controllers como en jobs/CLI.
 */
import type {
  HallazgoAuditoria,
  ReglaAuditoria,
  SeveridadAuditoria,
} from "@/types/auditoria";

export const REGLAS_AUDITORIA: ReglaAuditoria[] = [
  "docs_faltantes",
  "docs_pendientes_avanzado",
  "fechas",
  "ventas_sin_facturar",
  "margen_negativo",
  "margen_bajo",
  "venta_sin_costo",
  "costo_sin_venta",
  "proforma_vencida",
  "embarque_huerfano",
];

/** YYYY-MM-DD del día indicado (default: hoy) en horario local del navegador. */
export function isoDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Mínima fecha permitida para snooze: día siguiente al `from` (default: hoy).
 * Devuelve formato YYYY-MM-DD.
 */
export function minSnoozeDate(from: Date = new Date()): string {
  const t = new Date(from);
  t.setDate(t.getDate() + 1);
  return isoDate(t);
}

/**
 * Determina si un snooze está vigente comparando contra `today` (default: hoy).
 * Acepta `null`/`undefined` para casos donde la revisión no tiene snooze.
 */
export function isSnoozeActivo(
  snoozedUntil: string | null | undefined,
  today: string = isoDate(),
): boolean {
  if (!snoozedUntil) return false;
  return snoozedUntil >= today;
}

/** Conteo de hallazgos por severidad. Siempre devuelve las 3 llaves. */
export function contarPorSeveridad(
  hallazgos: HallazgoAuditoria[],
): Record<SeveridadAuditoria, number> {
  const acc: Record<SeveridadAuditoria, number> = {
    critico: 0,
    alto: 0,
    medio: 0,
  };
  for (const h of hallazgos) acc[h.severidad]++;
  return acc;
}

/** Agrupa hallazgos por regla, garantizando un array por cada regla conocida. */
export function agruparPorRegla(
  hallazgos: HallazgoAuditoria[],
): Record<ReglaAuditoria, HallazgoAuditoria[]> {
  const map = REGLAS_AUDITORIA.reduce(
    (acc, regla) => {
      acc[regla] = [];
      return acc;
    },
    {} as Record<ReglaAuditoria, HallazgoAuditoria[]>,
  );
  for (const h of hallazgos) map[h.regla].push(h);
  return map;
}

export interface FiltroHallazgos {
  severidad?: SeveridadAuditoria | "todas";
  modo?: string | "todos";
}

/** Filtro inmutable por severidad y modo. Valores `"todas"`/`"todos"` no filtran. */
export function filtrarHallazgos(
  hallazgos: HallazgoAuditoria[],
  filtro: FiltroHallazgos,
): HallazgoAuditoria[] {
  const sev = filtro.severidad ?? "todas";
  const modo = filtro.modo ?? "todos";
  if (sev === "todas" && modo === "todos") return hallazgos;
  return hallazgos.filter((h) => {
    if (sev !== "todas" && h.severidad !== sev) return false;
    if (modo !== "todos" && h.modo !== modo) return false;
    return true;
  });
}
