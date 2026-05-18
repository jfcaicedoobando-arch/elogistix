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
import { msg, getMessage } from "@/lib/domain/errorCatalog";

// Re-export del helper neutro para compatibilidad con imports existentes
export { formatValidationMessage } from "./validationFormat";

// ── Constantes de validación ──────────────────────────────────────────
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

function validateRutaModo(input: StepRutaInput): StepValidationErrors {
  if (input.modo === "Aéreo") {
    const r = aereoRuta.safeParse({
      aeropuertoOrigen: input.aeropuertoOrigen ?? "",
      aeropuertoDestino: input.aeropuertoDestino ?? "",
      mawb: input.mawb ?? "",
    });
    return r.success ? {} : flattenZodErrors(r.error);
  }
  if (input.modo === "Terrestre") {
    const r = terrestreRuta.safeParse({
      ciudadOrigen: input.ciudadOrigen ?? "",
      ciudadDestino: input.ciudadDestino ?? "",
      transportista: input.transportista ?? "",
    });
    return r.success ? {} : flattenZodErrors(r.error);
  }
  // Marítimo o sin modo definido
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

// ── Paso 3: Documentos ────────────────────────────────────────────────
export interface DocumentoArchivoValidacion {
  nombre: string;
  size: number;
  type: string;
}

export function validateArchivo(
  file: DocumentoArchivoValidacion,
): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    return getMessage("3.documento.tooLarge", {
      nombre: file.nombre,
      sizeMb,
      maxMb: MAX_FILE_SIZE_MB,
    });
  }
  if (file.type && !ALLOWED_MIME_TYPES.includes(file.type as never)) {
    return getMessage("3.documento.badFormat", { nombre: file.nombre });
  }
  return null;
}

export function validateStepDocumentos(
  archivos: Record<string, { size: number; type: string }>,
): StepValidationErrors {
  const errors: StepValidationErrors = {};
  for (const [nombre, file] of Object.entries(archivos)) {
    const err = validateArchivo({ nombre, size: file.size, type: file.type });
    if (err) errors[nombre] = err;
  }
  return errors;
}

// ── Paso 4: Costos y Pricing ──────────────────────────────────────────
export interface ConceptoVentaValidacion {
  id: number;
  concepto: string;
  cantidad: number;
  precioUnitario: number;
  moneda: string;
}

export interface ConceptoCostoValidacion {
  id: number;
  proveedorId: string;
  concepto: string;
  monto: number;
  moneda: string;
}

export interface StepCostosInput {
  conceptosVenta: ConceptoVentaValidacion[];
  conceptosCosto: ConceptoCostoValidacion[];
  tipoCambioUSD: string | number;
  tipoCambioEUR: string | number;
}

function parseTC(v: string | number): number {
  return typeof v === "string" ? parseFloat(v) : v;
}

function validarConceptosVenta(
  ventas: ConceptoVentaValidacion[],
  errors: StepValidationErrors,
): void {
  const validos = ventas.filter(
    (v) => v.concepto.trim() && v.precioUnitario > 0 && v.cantidad >= 1,
  );
  if (validos.length === 0) {
    errors.conceptosVenta = msg("4.ventas.minOne");
    return;
  }
  for (const v of ventas) {
    if (v.concepto.trim() && (v.cantidad < 1 || v.precioUnitario < 0)) {
      errors[`venta_${v.id}`] = getMessage("4.venta.invalid", { id: v.id });
    }
  }
}

function validarConceptosCosto(
  costos: ConceptoCostoValidacion[],
  errors: StepValidationErrors,
): void {
  const validos = costos.filter(
    (c) => c.concepto.trim() && c.proveedorId && c.monto >= 0,
  );
  if (validos.length === 0) {
    errors.conceptosCosto = msg("4.costos.minOne");
    return;
  }
  for (const c of costos) {
    if (c.concepto.trim() && c.monto < 0) {
      errors[`costo_${c.id}`] = getMessage("4.costo.invalid", { id: c.id });
    }
  }
}

export function validateStepCostos(input: StepCostosInput): StepValidationErrors {
  const errors: StepValidationErrors = {};

  const tcUSD = parseTC(input.tipoCambioUSD);
  const tcEUR = parseTC(input.tipoCambioEUR);
  if (!isFinite(tcUSD) || tcUSD <= 0) errors.tipoCambioUSD = msg("4.tcUSD.positive");
  if (!isFinite(tcEUR) || tcEUR <= 0) errors.tipoCambioEUR = msg("4.tcEUR.positive");

  validarConceptosVenta(input.conceptosVenta, errors);
  validarConceptosCosto(input.conceptosCosto, errors);

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
