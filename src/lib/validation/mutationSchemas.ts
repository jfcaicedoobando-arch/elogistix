/**
 * Bloque 2.2 — Validación zod en el boundary de mutaciones.
 *
 * Los wizards (Embarque, Cotización) ya validan paso a paso con zod, pero
 * existen otras vías de escritura (services llamados desde controllers,
 * importaciones futuras, RPC duplicate fix) donde nada garantiza que el
 * payload final cumpla las invariantes mínimas. Estos schemas son la última
 * red de seguridad antes de tocar la base.
 *
 * Reglas:
 *  - Mensajes en español MX, tuteo, con punto final.
 *  - Las claves del schema reflejan los campos persistidos, no los del form.
 *  - `parseOrThrow` re-lanza un Error con el primer issue (mensaje legible
 *    para toasts) y conserva el ZodError original como `cause`.
 */
import { z } from "zod";

// ── Helpers ───────────────────────────────────────────────────────────

/** Lanza Error legible si el payload no pasa el schema. */
export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown, contexto: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const first = result.error.issues[0];
  const path = first?.path?.join(".");
  const detalle = path ? `${path}: ${first.message}` : first?.message ?? "Datos inválidos.";
  const err = new Error(`${contexto} — ${detalle}`);
  (err as Error & { cause?: unknown }).cause = result.error;
  return err as never; // unreachable, contenta TS
}

const nonEmpty = (label: string, max = 200) =>
  z
    .string({ required_error: `${label}: requerido.`, invalid_type_error: `${label}: requerido.` })
    .trim()
    .min(1, `${label}: requerido.`)
    .max(max, `${label}: máximo ${max} caracteres.`);

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres.`)
    .optional()
    .or(z.literal(""))
    .or(z.null());

const rfcSchema = z
  .string()
  .trim()
  .max(20, "RFC: máximo 20 caracteres.")
  .optional()
  .or(z.literal(""))
  .or(z.null());

const emailSchema = z
  .string()
  .trim()
  .max(254, "Correo: máximo 254 caracteres.")
  .email("Correo: formato inválido.")
  .optional()
  .or(z.literal(""))
  .or(z.null());

const uuidSchema = z.string().uuid("Identificador inválido.");

// ── Cliente ───────────────────────────────────────────────────────────

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
  organization_id: uuidSchema.nullable().optional(),
}).passthrough(); // permite campos auxiliares no validados

export const clienteUpdateSchema = clienteInsertSchema.partial();

// ── Cotización ────────────────────────────────────────────────────────

const conceptoVentaSchema = z.object({
  descripcion: nonEmpty("Descripción del concepto", 300),
  cantidad: z.number().nonnegative("Cantidad: no puede ser negativa."),
  precio_unitario: z.number().nonnegative("Precio unitario: no puede ser negativo."),
  total: z.number().nonnegative("Total: no puede ser negativo."),
}).passthrough();

export const cotizacionInputSchema = z.object({
  cliente_nombre: nonEmpty("Cliente", 200),
  es_prospecto: z.boolean(),
  cliente_id: uuidSchema.nullable().optional(),
  modo: nonEmpty("Modo", 30),
  tipo: nonEmpty("Tipo", 30),
  incoterm: nonEmpty("Incoterm", 10),
  descripcion_mercancia: nonEmpty("Descripción de la mercancía", 1000),
  origen: nonEmpty("Origen", 200),
  destino: nonEmpty("Destino", 200),
  moneda: nonEmpty("Moneda", 5),
  vigencia_dias: z
    .number()
    .int("Vigencia: debe ser entero.")
    .min(1, "Vigencia: mínimo 1 día.")
    .max(365, "Vigencia: máximo 365 días."),
  subtotal: z.number().nonnegative("Subtotal: no puede ser negativo."),
  conceptos_venta: z.array(conceptoVentaSchema).min(1, "Conceptos: se requiere al menos uno."),
}).passthrough();

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

export type NotaInput = z.infer<typeof notaSchema>;
