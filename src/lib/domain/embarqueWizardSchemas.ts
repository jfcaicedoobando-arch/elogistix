/**
 * Esquemas de validación zod para el wizard "Nuevo Embarque".
 * Cada paso tiene su propio schema para validar de forma incremental.
 *
 * Estándar de mensajes (v8.96.0):
 *   - Todos los textos provienen del catálogo central `errorCatalog.ts`.
 *   - Patrón: "Etiqueta del campo: razón en imperativo o descriptiva."
 *   - Español MX, tuteo, termina con punto, sin signos de admiración.
 *   - Cualquier ajuste de tono/idioma se hace en `errorCatalog.ts` (única fuente).
 */
import { z } from "zod";
import { msg } from "@/lib/domain/errorCatalog";

// Re-export del helper neutro para compatibilidad con imports existentes
export { formatValidationMessage } from "./validationFormat";
export { MAX_FILE_SIZE_MB, MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from "./embarqueWizardConstants";
export { validateArchivo, validateStepDocumentos, type DocumentoArchivoValidacion } from "./embarqueWizardDocumentos";
export {
  validateStepCostos,
  type StepCostosInput,
  type ConceptoVentaValidacion,
  type ConceptoCostoValidacion,
} from "./embarqueWizardCostos";

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

function isValidDateStr(s: string | null | undefined): boolean {
  if (!s) return false;
  const d = new Date(s);
  return !isNaN(d.getTime());
}

// ── Etiquetas legibles de pasos (para títulos de toast) ───────────────
export const STEP_LABELS: Record<number, string> = {
  1: "Datos generales",
  2: "Ruta",
  3: "Documentos",
  4: "Costos",
};

// ── Paso 1: Datos Generales ───────────────────────────────────────────
export const stepDatosGeneralesSchema = z.object({
  modo: z.string().min(1, msg("1.modo.required")),
  tipo: z.string().min(1, msg("1.tipo.required")),
  clienteId: z.string().min(1, msg("1.clienteId.required")),
  descripcionMercancia: z
    .string()
    .trim()
    .min(1, msg("1.descripcion.required"))
    .max(500, msg("1.descripcion.maxLen")),
});

// ── Paso 2: Ruta (condicional por modo) ───────────────────────────────
const baseRutaFields = z.object({
  etd: z.string().min(1, msg("2.etd.required")),
  eta: z.string().min(1, msg("2.eta.required")),
});

const maritimoRuta = z.object({
  puertoOrigen: z.string().trim().min(1, msg("2.puertoOrigen.required")),
  puertoDestino: z.string().trim().min(1, msg("2.puertoDestino.required")),
  naviera: z.string().trim().min(1, msg("2.naviera.required")),
  tipoServicio: z.string().min(1, msg("2.tipoServicio.required")),
  contenedor: z.string().trim().min(1, msg("2.contenedor.required")),
  tipoContenedor: z.string().trim().min(1, msg("2.tipoContenedor.required")),
});

const aereoRuta = z.object({
  aeropuertoOrigen: z.string().trim().min(1, msg("2.aeropuertoOrigen.required")),
  aeropuertoDestino: z.string().trim().min(1, msg("2.aeropuertoDestino.required")),
  mawb: z.string().trim().min(1, msg("2.mawb.required")),
});

const terrestreRuta = z.object({
  ciudadOrigen: z.string().trim().min(1, msg("2.ciudadOrigen.required")),
  ciudadDestino: z.string().trim().min(1, msg("2.ciudadDestino.required")),
  transportista: z.string().trim().min(1, msg("2.transportista.required")),
});

export interface StepRutaInput {
  modo?: string | null;
  etd?: string | null;
  eta?: string | null;
  puertoOrigen?: string | null;
  puertoDestino?: string | null;
  naviera?: string | null;
  tipoServicio?: string | null;
  contenedor?: string | null;
  tipoContenedor?: string | null;
  aeropuertoOrigen?: string | null;
  aeropuertoDestino?: string | null;
  mawb?: string | null;
  ciudadOrigen?: string | null;
  ciudadDestino?: string | null;
  transportista?: string | null;
}

function validateMaritimoRuta(input: StepRutaInput): StepValidationErrors {
  const tipoContenedor = input.tipoServicio === "LCL"
    ? input.tipoContenedor || "LCL"
    : input.tipoContenedor ?? "";
  const r = maritimoRuta.safeParse({
    puertoOrigen: input.puertoOrigen ?? "",
    puertoDestino: input.puertoDestino ?? "",
    naviera: input.naviera ?? "",
    tipoServicio: input.tipoServicio ?? "",
    contenedor: input.contenedor ?? "",
    tipoContenedor,
  });
  return r.success ? {} : flattenZodErrors(r.error);
}

function validateAereoRuta(input: StepRutaInput): StepValidationErrors {
  const r = aereoRuta.safeParse({
    aeropuertoOrigen: input.aeropuertoOrigen ?? "",
    aeropuertoDestino: input.aeropuertoDestino ?? "",
    mawb: input.mawb ?? "",
  });
  return r.success ? {} : flattenZodErrors(r.error);
}

function validateTerrestreRuta(input: StepRutaInput): StepValidationErrors {
  const r = terrestreRuta.safeParse({
    ciudadOrigen: input.ciudadOrigen ?? "",
    ciudadDestino: input.ciudadDestino ?? "",
    transportista: input.transportista ?? "",
  });
  return r.success ? {} : flattenZodErrors(r.error);
}

function validateRutaModo(input: StepRutaInput): StepValidationErrors {
  if (input.modo === "Aéreo") return validateAereoRuta(input);
  if (input.modo === "Terrestre") return validateTerrestreRuta(input);
  return validateMaritimoRuta(input);
}

export function validateStepRuta(input: StepRutaInput): StepValidationErrors {
  const errors: StepValidationErrors = {};

  const baseRes = baseRutaFields.safeParse({
    etd: input.etd ?? "",
    eta: input.eta ?? "",
  });
  if (!baseRes.success) Object.assign(errors, flattenZodErrors(baseRes.error));

  Object.assign(errors, validateRutaModo(input));

  if (
    isValidDateStr(input.etd) &&
    isValidDateStr(input.eta) &&
    new Date(input.eta!) < new Date(input.etd!)
  ) {
    errors.eta = msg("2.eta.afterEtd");
  }

  return errors;
}

// ── Validador unificado del paso 1 (mantiene compatibilidad) ──────────
export function validateStepDatosGenerales(input: {
  modo?: string | null;
  tipo?: string | null;
  clienteId?: string | null;
  descripcionMercancia?: string | null;
}): StepValidationErrors {
  const res = stepDatosGeneralesSchema.safeParse({
    modo: input.modo ?? "",
    tipo: input.tipo ?? "",
    clienteId: input.clienteId ?? "",
    descripcionMercancia: input.descripcionMercancia ?? "",
  });
  return res.success ? {} : flattenZodErrors(res.error);
}

// ── Sugerencia automática de ETA ──────────────────────────────────────
/**
 * Calcula una ETA sugerida sumando días de tránsito al ETD.
 * Devuelve string YYYY-MM-DD o null si no se puede calcular.
 */
export function sugerirETA(
  etd: string | null | undefined,
  diasTransito: number | null | undefined,
): string | null {
  if (!isValidDateStr(etd) || !diasTransito || diasTransito <= 0) return null;
  const d = new Date(etd!);
  d.setDate(d.getDate() + diasTransito);
  return d.toISOString().slice(0, 10);
}
