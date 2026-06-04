/**
 * Configuración visual del score de salud operativa (Auditoría ejecutiva).
 */
export type ScoreEstado = "excelente" | "bueno" | "regular" | "malo";

export interface ScoreEstadoConfig {
  label: string;
  text: string;
  accent: string;
  msg: string;
}

export const SCORE_ESTADO_CONFIG: Record<ScoreEstado, ScoreEstadoConfig> = {
  excelente: {
    label: "Excelente",
    text: "text-success",
    accent: "bg-success",
    msg: "Operación bajo control. Sin hallazgos críticos pendientes.",
  },
  bueno: {
    label: "Bueno",
    text: "text-info",
    accent: "bg-info",
    msg: "Algunos pendientes menores. Operación sana.",
  },
  regular: {
    label: "Regular",
    text: "text-warning",
    accent: "bg-warning",
    msg: "Hay pendientes que requieren atención esta semana.",
  },
  malo: {
    label: "Atención",
    text: "text-destructive",
    accent: "bg-destructive",
    msg: "Pendientes críticos acumulados. Acción inmediata recomendada.",
  },
};
