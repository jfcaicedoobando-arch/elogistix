/**
 * Tokens de color para gráficas (recharts).
 *
 * Recharts recibe colores como cadenas (`stroke`, `fill`), así que no puede
 * usar clases de Tailwind. Para no volver a hardcodear valores `hsl(...)` o
 * hex en cada gráfica, aquí se centralizan las referencias a las variables
 * CSS del tema (`index.css`). Así el color sigue viniendo del sistema de
 * diseño y respeta modo claro/oscuro.
 *
 * Uso:
 *   <Line stroke={CHART.warning} />
 *   <Cell fill={CHART_SERIES[i % CHART_SERIES.length]} />
 */

export const CHART = {
  primary: "hsl(var(--primary))",
  accent: "hsl(var(--accent))",
  success: "hsl(var(--success))",
  info: "hsl(var(--info))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
  /** Rojo del token destructivo con más peso visual (cubeta crítica). */
  destructiveStrong: "hsl(var(--destructive) / 0.9)",
  /** Tono suave del token destructivo (cubeta de riesgo medio). */
  destructiveSoft: "hsl(var(--destructive) / 0.7)",
  neutral: "hsl(var(--muted-foreground) / 0.55)",
  border: "hsl(var(--border))",
  popover: "hsl(var(--popover))",
} as const;

/** Rampa monocromática para series sin semántica propia (top N, rankings). */
export const CHART_SERIES: readonly string[] = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.85)",
  "hsl(var(--primary) / 0.7)",
  "hsl(var(--primary) / 0.6)",
  "hsl(var(--primary) / 0.5)",
  "hsl(var(--primary) / 0.45)",
  "hsl(var(--primary) / 0.4)",
  "hsl(var(--primary) / 0.35)",
  "hsl(var(--primary) / 0.3)",
  "hsl(var(--primary) / 0.25)",
];

/** Color por omisión para datos de color capturados por el usuario (CRM). */
export const COLOR_ETAPA_DEFAULT = "hsl(var(--muted-foreground))";

/**
 * Ola E · V-4 — geometría común de los ejes, leyenda y barras.
 * Antes cada gráfica elegía su propio `fontSize` (10/11/12) y su propio radio
 * de barra ([3,3,0,0] vs [4,4,0,0]); esto lo vuelve un solo contrato.
 */
export const CHART_TICK = { fontSize: 11, fill: "hsl(var(--muted-foreground))" } as const;
export const CHART_AXIS_STROKE = "hsl(var(--border))";
export const CHART_LEGEND_STYLE = { fontSize: 11 } as const;
export const CHART_BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];
