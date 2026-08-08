/**
 * Definición ÚNICA de las cubetas de antigüedad (aging) de la app.
 *
 * La usan las tres vistas de antigüedad para que todas partan de los mismos
 * rangos, etiquetas y colores:
 *  - `/cobranza/aging`  (resumen por cliente)
 *  - `/compras/aging`   (resumen por proveedor)
 *  - `/reportes/cartera` (reporte contable factura por factura)
 *
 * Sin red ni React.
 */
import type { ChipTone } from "@/lib/ui/badgeTone";

export type CubetaAging = "vigente" | "d_1_30" | "d_31_60" | "d_61_90" | "mas_90";

export const CUBETAS_AGING: readonly CubetaAging[] = [
  "vigente",
  "d_1_30",
  "d_31_60",
  "d_61_90",
  "mas_90",
] as const;

/**
 * Cubeta a partir de los días vencidos.
 * `dias <= 0` significa que la factura aún no vence (vigente).
 */
export function bucketDeDias(dias: number): CubetaAging {
  if (dias <= 0) return "vigente";
  if (dias <= 30) return "d_1_30";
  if (dias <= 60) return "d_31_60";
  if (dias <= 90) return "d_61_90";
  return "mas_90";
}

/** Etiqueta corta, para badges y encabezados de tabla. */
export const CUBETA_LABELS: Record<CubetaAging, string> = {
  vigente: "Vigente",
  d_1_30: "1-30 d",
  d_31_60: "31-60 d",
  d_61_90: "61-90 d",
  mas_90: "+90 d",
};

/** Etiqueta larga, para KPIs y reportes exportados. */
export const CUBETA_LABELS_LARGAS: Record<CubetaAging, string> = {
  vigente: "Vigente",
  d_1_30: "1-30 días",
  d_31_60: "31-60 días",
  d_61_90: "61-90 días",
  mas_90: "+90 días",
};

/** Tono semántico por cubeta — consumido por `<ToneBadge tone={...} />`. */
export const CUBETA_TONE: Record<CubetaAging, ChipTone> = {
  vigente: "neutral",
  d_1_30: "warning",
  d_31_60: "warning",
  d_61_90: "destructive",
  mas_90: "destructive",
};

/** Tono para tarjetas KPI (`KpiCard` / `AgingKpiBucket`). */
export type TonoKpiAging = "default" | "warn" | "danger";

export const CUBETA_TONO_KPI: Record<CubetaAging, TonoKpiAging> = {
  vigente: "default",
  d_1_30: "warn",
  d_31_60: "warn",
  d_61_90: "danger",
  mas_90: "danger",
};

/**
 * Monedas presentes en un conjunto de filas, ordenadas con MXN/USD/EUR primero.
 * Compartido por CxC y CxP para que ambos selectores de moneda se comporten igual.
 */
export function monedasPresentes(rows: readonly { moneda: string }[]): string[] {
  const preferidas = ["MXN", "USD", "EUR"];
  const arr = Array.from(new Set((rows ?? []).map((r) => (r.moneda || "MXN").toUpperCase())));
  arr.sort((a, b) => {
    const ia = preferidas.indexOf(a);
    const ib = preferidas.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  return arr;
}
