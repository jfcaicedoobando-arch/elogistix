/**
 * Esquemas de validación zod para el wizard "Nuevo embarque".
 * Cada paso tiene su propio schema para validar de forma incremental.
 *
 * Estándar de mensajes (v8.96.0):
 *   - Todos los textos provienen del catálogo central `errorCatalog.ts`.
 *   - Patrón: "Etiqueta del campo: razón en imperativo o descriptiva."
 *   - Español MX, tuteo, termina con punto, sin signos de admiración.
 *   - Cualquier ajuste de tono/idioma se hace en `errorCatalog.ts` (única fuente).
 *
 * Power-of-10 (≤200 líneas): la validación del Paso 2 (Ruta) y `sugerirETA`
 * viven en `embarqueWizardRuta.ts`; aquí dejamos paso 1, helpers y re-exports.
 */
import { z } from "zod";
import { msg } from "@/lib/domain/errorCatalog";

// Re-export del helper neutro para compatibilidad con imports existentes
;
export { MAX_FILE_SIZE_MB, STEP_LABELS } from "./embarqueWizardConstants";
export { validateArchivo, validateStepDocumentos,  } from "./embarqueWizardDocumentos";
export {
  validateStepCostos,
  
  type ConceptoVentaValidacion,
  type ConceptoCostoValidacion,
} from "./embarqueWizardCostos";
// Re-export del paso 2 desde su módulo dedicado.
export { validateStepRuta, sugerirETA, type StepRutaInput } from "./embarqueWizardRuta";

// ── Tipo plano de errores por campo ───────────────────────────────────
export type StepValidationErrors = Record<string, string>;

// ── Helpers ───────────────────────────────────────────────────────────
function flattenZodErrors(error: z.ZodError): StepValidationErrors {
  const out: StepValidationErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_root";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// `STEP_LABELS` vive en `embarqueWizardConstants.ts` (sin zod) y se re-exporta
// arriba para no romper imports existentes.



// ── Paso 1: Datos Generales ───────────────────────────────────────────
export const stepDatosGeneralesSchema = z.object({
  modo: z.string().min(1, msg("1.modo.required")),
  tipo: z.string().min(1, msg("1.tipo.required")),
  clienteId: z.string().min(1, msg("1.clienteId.required")),
  incoterm: z.string().min(1, msg("1.incoterm.required")),
  descripcionMercancia: z
    .string()
    .trim()
    .min(1, msg("1.descripcion.required"))
    .max(500, msg("1.descripcion.maxLen")),
});

// ── Validador unificado del paso 1 (mantiene compatibilidad) ──────────
export function validateStepDatosGenerales(input: {
  modo?: string | null;
  tipo?: string | null;
  clienteId?: string | null;
  incoterm?: string | null;
  descripcionMercancia?: string | null;
}): StepValidationErrors {
  const res = stepDatosGeneralesSchema.safeParse({
    modo: input.modo ?? "",
    tipo: input.tipo ?? "",
    clienteId: input.clienteId ?? "",
    incoterm: input.incoterm ?? "",
    descripcionMercancia: input.descripcionMercancia ?? "",
  });
  return res.success ? {} : flattenZodErrors(res.error);
}
