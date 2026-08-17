/**
 * Schema de validación para la edición inline de límites de plan.
 * Extraído de `TabPlanes.tsx` (Power of 10: máx. 200 líneas por archivo).
 *
 * EC-20: los inputs type="number" no bloquean NaN/negativos al teclear; se
 * valida en el submit antes de persistir los límites del plan.
 */
import { z } from "zod";

export const planEditSchema = z.object({
  max_usuarios: z.number().int().min(1).max(100_000),
  max_embarques_mes: z.number().int().min(1).max(1_000_000),
  almacenamiento_mb: z.number().int().min(0).max(10_000_000),
  precio_mensual: z.number().min(0).max(100_000_000),
});
