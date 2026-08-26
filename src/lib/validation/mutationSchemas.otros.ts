/**
 * Schemas de mutación para Embarque, Notas y Tracking. Extraído de
 * `mutationSchemas.ts` (Power of 10: máx. 200 líneas por archivo).
 */
import { z } from "zod";
import { nonEmpty, uuidSchema } from "./mutationSchemas.shared";

// ── Embarque ──────────────────────────────────────────────────────────

/**
 * Sólo los campos que la BD requiere y son trivialmente validables.
 * El detalle por modo (FCL/LCL/Aéreo) ya vive en `embarqueWizardSchemas`.
 */
export const embarqueInsertSchema = z.object({
  cliente_nombre: nonEmpty("Cliente", 200),
  modo: nonEmpty("Modo", 30),
  operador: nonEmpty("Operador", 150),
  tipo_carga: z.string().trim().max(100).optional().or(z.null()),
  expediente: z.string().trim().max(50).optional().or(z.null()),
  organization_id: uuidSchema.nullable().optional(),
}).passthrough();

// ── Notas ─────────────────────────────────────────────────────────────

export const notaSchema = z.object({
  contenido: nonEmpty("Nota", 2000),
  usuario: nonEmpty("Usuario", 254),
});

// ── Tracking: nuevo evento de embarque ────────────────────────────────

export const eventoTrackingSchema = z.object({
  tipo: z.string().min(1, "Selecciona un tipo de evento"),
  // B-24: formato `AAAA-MM-DD` (se acepta un ISO completo y se recorta la parte
  // de fecha) — antes cualquier string pasaba y llegaba basura a la BD.
  fecha: z
    .string()
    .min(1, "Fecha requerida")
    .transform((v) => v.slice(0, 10))
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida (usa AAAA-MM-DD)"),
  ubicacion: z.string().max(120, "Máximo 120 caracteres").optional().default(""),
  descripcion: z.string().max(500, "Máximo 500 caracteres").optional().default(""),
});
