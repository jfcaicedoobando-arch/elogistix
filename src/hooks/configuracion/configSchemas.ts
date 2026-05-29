/**
 * Schemas Zod para los records JSONB de `configuracion` (categorías
 * `seguridad` y `plataforma`). Reemplazan los `as boolean/number/string`
 * dispersos por el panel admin.
 *
 * `parseConfigSafe` aplica defaults si algún campo viene con tipo incorrecto,
 * preservando la resiliencia visual del panel.
 */
import { z } from "zod";

export const seguridadConfigSchema = z.object({
  auto_confirmar_email: z.boolean().default(false),
  longitud_minima_password: z.number().int().min(6).max(64).default(8),
  expiracion_sesion_horas: z.number().int().min(1).max(720).default(24),
  max_intentos_login: z.number().int().min(3).max(20).default(5),
  permitir_registro_publico: z.boolean().default(false),
});



export const plataformaConfigSchema = z.object({
  email_soporte: z.string().default(""),
});



/**
 * Parse con fallback: si el record tiene campos con tipo inválido, retorna
 * los defaults del schema en vez de lanzar. Evita romper el panel admin
 * cuando un valor histórico quedó guardado con tipo erróneo.
 */
export function parseConfigSafe<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  raw: Record<string, unknown>,
): z.infer<T> {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  return schema.parse({}) as z.infer<T>;
}
