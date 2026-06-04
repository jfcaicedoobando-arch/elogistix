/**
 * Umbrales de calificación de auditoría — usados por `calcularScore` para
 * mapear un score numérico (0–100) a un estado cualitativo.
 *
 * Centralizado aquí para que cualquier cambio de regla de negocio sea un
 * único edit en lugar de un grep entre componentes.
 */
export const SCORE_THRESHOLDS = {
  EXCELENTE: 90,
  BUENO: 75,
  REGULAR: 60,
} as const;
