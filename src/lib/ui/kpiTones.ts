/**
 * Paleta categórica para tarjetas KPI / métricas / chips informativos.
 *
 * Estas tonalidades son **categóricas, no semánticas**: se usan para
 * diferenciar visualmente tarjetas de un mismo grupo (Embarques vs
 * Cotizaciones vs Profit). Para semántica de estado (success/warning/error)
 * usar los tokens `success`, `warning`, `destructive` del design system.
 *
 * Tokens definidos en `src/index.css` (`--kpi-*` y `--kpi-*-soft`) y
 * registrados como utilidades Tailwind `bg-kpi-{tone}` / `text-kpi-{tone}` /
 * `bg-kpi-{tone}-soft`.
 */
export type KpiTone =
  | "info"
  | "success"
  | "accent"
  | "warning"
  | "secondary"
  | "danger";

/**
 * Devuelve las clases Tailwind para un "icon chip" (cuadrado redondeado con
 * fondo pastel y color de icono). Usado en KpiCard, ClienteSummaryCards, etc.
 */
export function kpiIconChipClasses(tone: KpiTone): string {
  return `bg-kpi-${tone}-soft text-kpi-${tone}`;
}

/**
 * Variante "solid" (fondo saturado + foreground claro) — para tarjetas
 * destacadas como "Activas hoy".
 */
export function kpiSolidClasses(tone: KpiTone): string {
  return `bg-kpi-${tone} text-white`;
}
