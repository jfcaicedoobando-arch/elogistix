/**
 * Reglas puras del dominio Auditoría operativa.
 *
 * Funciones sin dependencias de React/Supabase para que puedan ser testeadas
 * aisladamente y reutilizadas tanto en hooks/controllers como en jobs/CLI.
 *
 * **Contrato temporal**: TODAS las funciones de fecha de este módulo operan
 * en UTC. Esto garantiza que los umbrales de snooze, ETA y proforma vencida
 * sean idénticos sin importar la zona horaria del navegador o del runner de
 * CI (CDMX UTC-6 vs CI en UTC). No usar `Date#getDate`/`setDate` (locales);
 * usar siempre los equivalentes `getUTC*`/`setUTC*` o `Date.UTC(...)`.
 */
import type {
  HallazgoAuditoria,
  ReglaAuditoria,
  SeveridadAuditoria,
} from "@/features/auditoria/types";
import { isoUtcDay } from "@/lib/date/mx";

export const REGLAS_AUDITORIA: ReglaAuditoria[] = [
  "docs_faltantes",
  "docs_pendientes_avanzado",
  "fechas",
  "ventas_sin_facturar",
  "margen_negativo",
  "margen_bajo",
  "venta_sin_costo",
  "costo_sin_venta",
  "costos_repetidos",
  "proforma_vencida",
  "proforma_borrador_abandonada",
  "proforma_inconsistente",
  "embarque_huerfano",
  "factura_sin_timbrar",
  "rep_pendiente",
  "factura_cancelada_sin_sustitucion",
  "cxc_vencida",
  "cxp_por_capturar_estancada",
  "cxp_vencida",
  "contenedor_datos_incompletos",
  "contenedor_fechas_incompletas",
  "tipo_cambio_faltante",
];

/** YYYY-MM-DD del día indicado (default: hoy) **en UTC**. */
export function isoDate(date: Date = new Date()): string {
  return isoUtcDay(date);
}

/** Atajo: día actual en UTC (formato YYYY-MM-DD). Punto único para reglas temporales. */
export function todayUtcIso(): string {
  return isoDate(new Date());
}

/**
 * Mínima fecha permitida para snooze: día siguiente al `from` (default: hoy),
 * calculado **en UTC** para evitar drift por zona horaria del runtime.
 * Devuelve formato YYYY-MM-DD.
 */
export function minSnoozeDate(from: Date = new Date()): string {
  const next = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + 1),
  );
  return isoDate(next);
}

/**
 * Determina si un snooze está vigente comparando contra `today` (default: hoy en UTC).
 * Ambos argumentos DEBEN venir en UTC (producidos por `isoDate`/`todayUtcIso`)
 * para que la comparación lexicográfica sea correcta.
 * Acepta `null`/`undefined` para casos donde la revisión no tiene snooze.
 */
export function isSnoozeActivo(
  snoozedUntil: string | null | undefined,
  today: string = todayUtcIso(),
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
  for (const h of hallazgos) {
    // Regla desconocida (p.ej. backfill agregó una nueva): inicializa on-demand.
    if (!map[h.regla]) map[h.regla] = [];
    map[h.regla].push(h);
  }
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
