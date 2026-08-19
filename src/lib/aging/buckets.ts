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

/**
 * v13.682.0 · UI-2 — ESCALA ÚNICA DE COLOR de antigüedad.
 *
 * Antes cada módulo pintaba la misma deuda distinta (Cobranza usaba
 * `text-aging-*` con cortes en 15 días, Facturación usaba `bg-warning/60`).
 * Ahora todas las vistas derivan el color de la misma cubeta y de los tokens
 * `--aging-1..5` definidos en `index.css` (light/dark automáticos).
 */
export type NivelAging = 1 | 2 | 3 | 4 | 5;

export const CUBETA_NIVEL: Record<CubetaAging, NivelAging> = {
  vigente: 1,
  d_1_30: 2,
  d_31_60: 3,
  d_61_90: 4,
  mas_90: 5,
};

/** Nivel de severidad (1..5) a partir de los días vencidos. */
export function nivelAgingDeDias(dias: number): NivelAging {
  return CUBETA_NIVEL[bucketDeDias(dias)];
}

/** Color de texto por nivel (listas y celdas de días vencidos). */
export const AGING_TEXT_CLASS: Record<NivelAging, string> = {
  1: "text-aging-1",
  2: "text-aging-2",
  3: "text-aging-3",
  4: "text-aging-4",
  5: "text-aging-5",
};

/** Chip sólido por nivel (bandejas de cobranza y tarjetas de factura). */
export const AGING_SOLID_CLASS: Record<NivelAging, string> = {
  1: "bg-aging-1/15 text-aging-1 border border-aging-1/30",
  2: "bg-aging-2/15 text-aging-2 border border-aging-2/30",
  3: "bg-aging-3/15 text-aging-3 border border-aging-3/30",
  4: "bg-aging-4/15 text-aging-4 border border-aging-4/30",
  5: "bg-aging-5/20 text-aging-5 border border-aging-5/40",
};

/** Relleno suave por nivel (chips de KPI y barras de dashboard). */
export const AGING_SOFT_CLASS: Record<NivelAging, string> = {
  1: "bg-aging-1/20 text-foreground",
  2: "bg-aging-2/25 text-foreground",
  3: "bg-aging-3/30 text-foreground",
  4: "bg-aging-4/35 text-foreground",
  5: "bg-aging-5/40 text-foreground",
};

/** Relleno sólido por nivel (segmentos de barra apilada). */
export const AGING_FILL_CLASS: Record<NivelAging, string> = {
  1: "bg-aging-1",
  2: "bg-aging-2",
  3: "bg-aging-3",
  4: "bg-aging-4",
  5: "bg-aging-5",
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

/**
 * Claves de cubeta que devuelve la RPC de antigüedad de proveedores
 * (`proveedor_estado_cuenta`). Son un **contrato de base de datos**, por eso se
 * conservan tal cual; lo que se centraliza aquí es el orden, las etiquetas y
 * los tonos, para que CxC y CxP nunca se desincronicen (paso 6 de la auditoría).
 */
export const CUBETAS_WIRE_PROVEEDOR = ["Vigente", "1-30", "31-60", "61-90", "90+"] as const;

export type CubetaWireProveedor = (typeof CUBETAS_WIRE_PROVEEDOR)[number];

/** Cubeta canónica ↔ clave de la RPC, en el mismo orden que `CUBETAS_AGING`. */
export const CUBETA_WIRE_PROVEEDOR = {
  vigente: "Vigente",
  d_1_30: "1-30",
  d_31_60: "31-60",
  d_61_90: "61-90",
  mas_90: "90+",
} as const satisfies Record<CubetaAging, CubetaWireProveedor>;

/** Inverso: clave de la RPC → cubeta canónica. */
export const WIRE_A_CUBETA_PROVEEDOR = Object.fromEntries(
  CUBETAS_AGING.map((c) => [CUBETA_WIRE_PROVEEDOR[c], c]),
) as Record<CubetaWireProveedor, CubetaAging>;

/** Etiqueta larga por clave de la RPC (derivada del catálogo central). */
export const CUBETA_WIRE_LABELS_PROVEEDOR = Object.fromEntries(
  CUBETAS_AGING.map((c) => [CUBETA_WIRE_PROVEEDOR[c], CUBETA_LABELS_LARGAS[c]]),
) as Record<CubetaWireProveedor, string>;

/** Tono KPI por clave de la RPC (derivado del catálogo central). */
export const CUBETA_WIRE_TONO_KPI_PROVEEDOR = Object.fromEntries(
  CUBETAS_AGING.map((c) => [CUBETA_WIRE_PROVEEDOR[c], CUBETA_TONO_KPI[c]]),
) as Record<CubetaWireProveedor, TonoKpiAging>;
