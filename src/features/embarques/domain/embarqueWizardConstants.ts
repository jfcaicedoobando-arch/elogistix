export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

/**
 * Etiquetas legibles de los pasos del wizard (títulos de toast).
 * Vive aquí (módulo sin zod) para que `@/lib/ui/appFeedback` no arrastre los
 * esquemas del wizard —ni zod— al bundle inicial de la app.
 */
export const STEP_LABELS: Record<number, string> = {
  1: "Datos generales",
  2: "Ruta",
  3: "Documentos",
  4: "Costos",
};
