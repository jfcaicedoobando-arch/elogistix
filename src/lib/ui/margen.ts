/**
 * Ola 5 · 5.6 — Fuente única del *tono* de un porcentaje de margen.
 *
 * Antes cada módulo decidía por su cuenta cuándo un margen era "bueno":
 * Reportes usaba 20/10, Cotización 15/0 y Proyección 10/0, cada uno con su
 * propio `if` y sus propias clases de color. Aquí viven las escalas y el
 * mapeo a tono semántico; los componentes sólo consumen `MargenBadge` /
 * `claseTonoMargen`.
 */

export interface UmbralesMargen {
  /** A partir de este % el margen se considera sano (verde). */
  readonly GOOD: number;
  /** A partir de este % el margen es aceptable pero bajo (ámbar). */
  readonly WARN: number;
}

/** Escala por defecto (Reportes, rentabilidad por cliente). */
export const UMBRAL_MARGEN: UmbralesMargen = { GOOD: 20, WARN: 10 };

/** Escala de cotización/venta (más laxa: el precio aún no incluye extras). */
export const UMBRAL_MARGEN_COTIZACION: UmbralesMargen = { GOOD: 15, WARN: 0 };

/** Escala operativa de proyección y P&L de embarque. */
export const UMBRAL_MARGEN_OPERATIVO: UmbralesMargen = { GOOD: 10, WARN: 0 };

export type TonoMargen = "success" | "warning" | "destructive" | "neutral";

export interface OpcionesTonoMargen {
  umbrales?: UmbralesMargen;
  /**
   * Venta asociada. Si es 0 el margen no es una alarma (no hay operación),
   * así que el tono es neutro en lugar de rojo.
   */
  venta?: number | null;
}

/** Tono semántico de un porcentaje de margen. */
export function tonoMargen(pct: number | null | undefined, opciones: OpcionesTonoMargen = {}): TonoMargen {
  const { umbrales = UMBRAL_MARGEN, venta } = opciones;
  if (pct == null || !Number.isFinite(pct)) return "neutral";
  if (venta !== undefined && venta !== null && venta === 0) return "neutral";
  if (pct >= umbrales.GOOD) return "success";
  if (pct >= umbrales.WARN) return "warning";
  return "destructive";
}

const CLASES: Record<TonoMargen, string> = {
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  neutral: "text-muted-foreground",
};

/** Clase de color de texto para un porcentaje de margen. */
export function claseTonoMargen(pct: number | null | undefined, opciones: OpcionesTonoMargen = {}): string {
  return CLASES[tonoMargen(pct, opciones)];
}
