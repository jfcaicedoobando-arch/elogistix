/**
 * Schemas de mutación para Cliente. Extraído de `mutationSchemas.ts`
 * (Power of 10: máx. 200 líneas por archivo).
 */
import { z } from "zod";
import { nonEmpty, optionalText, rfcSchema, emailSchema, uuidSchema } from "./mutationSchemas.shared";

export const clienteInsertSchema = z.object({
  nombre: nonEmpty("Nombre del cliente", 200),
  rfc: rfcSchema,
  email: emailSchema,
  telefono: z.string().trim().max(40, "Teléfono: máximo 40 caracteres.").optional().or(z.null()),
  contacto: z.string().trim().max(150, "Contacto: máximo 150 caracteres.").optional().or(z.null()),
  ciudad: optionalText(120),
  estado: optionalText(120),
  cp: z.string().trim().max(10, "CP: máximo 10 caracteres.").optional().or(z.null()),
  direccion: optionalText(300),
  dias_credito: z
    .number()
    .int("Días de crédito: debe ser entero.")
    .min(0, "Días de crédito: no puede ser negativo.")
    .max(365, "Días de crédito: máximo 365.")
    .nullable()
    .optional(),
  limite_credito_mxn: z
    .number()
    .min(0, "Límite de crédito: no puede ser negativo.")
    .max(1_000_000_000, "Límite de crédito: fuera de rango.")
    .nullable()
    .optional(),
  regimen_fiscal: z.string().trim().max(10, "Régimen fiscal: máximo 10 caracteres.").optional().or(z.null()),
  uso_cfdi_default: z.string().trim().max(10, "Uso CFDI: máximo 10 caracteres.").optional().or(z.null()),
  requiere_autorizacion_cotizacion: z.boolean().optional(),
  requiere_autorizacion_proforma: z.boolean().optional(),
  organization_id: uuidSchema.nullable().optional(),
}).passthrough(); // permite campos auxiliares no validados

export const clienteUpdateSchema = clienteInsertSchema.partial();
