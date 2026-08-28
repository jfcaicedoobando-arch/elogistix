/**
 * Schemas de mutación para Cotización. Extraído de `mutationSchemas.ts`
 * (Power of 10: máx. 200 líneas por archivo).
 */
import { z } from "zod";
import { nonEmpty, uuidSchema } from "./mutationSchemas.shared";
import { MONTO_MAX, CANTIDAD_MAX } from "./limitesNumericos";

/**
 * B-23: topes de magnitud. No convertimos los objetos a `.strict()` a propósito
 * — las mutaciones envían legítimamente más columnas que las listadas —, pero sí
 * acotamos los números para que un dedazo (o un `NaN`/`Infinity`) no escriba
 * importes absurdos en la base.
 */

const montoSchema = (label: string) =>
  z
    .number()
    .finite(`${label}: debe ser un número válido.`)
    .nonnegative(`${label}: no puede ser negativo.`)
    .max(MONTO_MAX, `${label}: excede el máximo permitido (999,999,999.99).`);

const conceptoVentaSchema = z.object({
  descripcion: nonEmpty("Descripción del concepto", 300),
  cantidad: z
    .number()
    .finite("Cantidad: debe ser un número válido.")
    .nonnegative("Cantidad: no puede ser negativa.")
    .max(CANTIDAD_MAX, "Cantidad: excede el máximo permitido (1,000,000)."),
  precio_unitario: montoSchema("Precio unitario"),
  total: montoSchema("Total"),
}).passthrough();

const cotizacionBaseSchema = z.object({
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
  subtotal: montoSchema("Subtotal"),
}).passthrough();

export const cotizacionDraftInputSchema = cotizacionBaseSchema.extend({
  // Permitido vacío al crear el borrador en Paso 1; los conceptos se capturan en Paso 3.
  conceptos_venta: z.array(conceptoVentaSchema),
}).passthrough();

// Alias por compatibilidad: el "input" completo coincide hoy con el draft.
// (knip detecta duplicado si se vuelve a `export const`, por eso lo re-exportamos como alias.)
export { cotizacionDraftInputSchema as cotizacionInputSchema };

/**
 * M4 — Boundary de `updateCotizacion`: patch parcial. Sólo se validan los
 * campos presentes, pero los montos y los conceptos de venta se revisan
 * siempre que vengan en el patch (era la vía que escribía dinero sin red).
 */
export const cotizacionUpdateSchema = cotizacionBaseSchema
  .partial()
  .extend({
    conceptos_venta: z.array(conceptoVentaSchema).optional(),
    total: montoSchema("Total").optional(),
    iva: montoSchema("IVA").optional(),
    tipo_cambio: z.number().positive("Tipo de cambio: debe ser mayor a cero.").optional().nullable(),
  })
  .passthrough();
