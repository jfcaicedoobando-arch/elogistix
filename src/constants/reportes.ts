/**
 * Umbrales de margen para badges de rentabilidad por cliente.
 * Usados por `ReportesTablaClientes` para colorear el porcentaje
 * (success ≥20%, warning ≥10%, destructive el resto).
 */
export const MARGIN_THRESHOLDS = {
  GOOD: 20,
  WARN: 10,
} as const;
