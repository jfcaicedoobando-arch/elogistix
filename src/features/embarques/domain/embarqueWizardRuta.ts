/**
 * Validación del Paso 2 ("Ruta") del wizard de Nuevo Embarque.
 * Extraído de `embarqueWizardSchemas.ts` para mantener cada archivo bajo el
 * límite Power-of-10 (≤200 líneas).
 */
import { isoUtcDay } from "@/lib/date/mx";
import { z } from "zod";
import { msg } from "@/lib/domain/errorCatalog";
import type { StepValidationErrors } from "./embarqueWizardSchemas";

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

const baseRutaFields = z.object({
  etd: z.string().min(1, msg("2.etd.required")),
  eta: z.string().min(1, msg("2.eta.required")),
});

const maritimoRutaBase = z.object({
  puertoOrigen: z.string().trim().min(1, msg("2.puertoOrigen.required")),
  puertoDestino: z.string().trim().min(1, msg("2.puertoDestino.required")),
  naviera: z.string().trim().min(1, msg("2.naviera.required")),
  tipoServicio: z.string().min(1, msg("2.tipoServicio.required")),
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

/** Fila mínima de contenedor para validar el paso 2. */
interface ContenedorRutaItem {
  numero_contenedor?: string | null;
  tipo_contenedor?: string | null;
}

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
  contenedores?: ContenedorRutaItem[] | null;
  aeropuertoOrigen?: string | null;
  aeropuertoDestino?: string | null;
  mawb?: string | null;
  ciudadOrigen?: string | null;
  ciudadDestino?: string | null;
  transportista?: string | null;
}

function validateContenedoresFcl(
  contenedores: ContenedorRutaItem[],
): StepValidationErrors {
  const errors: StepValidationErrors = {};
  if (contenedores.length === 0) {
    errors.contenedores = msg("2.contenedores.minOne");
    return errors;
  }
  for (let i = 0; i < contenedores.length; i++) {
    const c = contenedores[i];
    if (!c.numero_contenedor || !c.numero_contenedor.trim()) {
      errors[`contenedores.${i}.numero_contenedor`] = msg("2.contenedores.item.numero");
    }
    if (!c.tipo_contenedor || !c.tipo_contenedor.trim()) {
      errors[`contenedores.${i}.tipo_contenedor`] = msg("2.contenedores.item.tipo");
    }
    // B-014 (v13.320.41): peso, volumen y piezas nunca deben ser negativos.
    // El input UI ya bloquea el signo, pero validamos defensivamente para no
    // depender de la UI (import CSV, edición programática, tests, etc.).
    const raw = c as ContenedorRutaItem & { peso_kg?: number; volumen_m3?: number; piezas?: number };
    if (typeof raw.peso_kg === "number" && raw.peso_kg < 0) {
      errors[`contenedores.${i}.peso_kg`] = "Peso: no puede ser negativo.";
    }
    if (typeof raw.volumen_m3 === "number" && raw.volumen_m3 < 0) {
      errors[`contenedores.${i}.volumen_m3`] = "Volumen: no puede ser negativo.";
    }
    if (typeof raw.piezas === "number" && raw.piezas < 0) {
      errors[`contenedores.${i}.piezas`] = "Piezas: no puede ser negativo.";
    }
  }
  return errors;
}

function validateMaritimoRuta(input: StepRutaInput): StepValidationErrors {
  const base = maritimoRutaBase.safeParse({
    puertoOrigen: input.puertoOrigen ?? "",
    puertoDestino: input.puertoDestino ?? "",
    naviera: input.naviera ?? "",
    tipoServicio: input.tipoServicio ?? "",
  });
  const errors: StepValidationErrors = base.success ? {} : flattenZodErrors(base.error);

  // LCL: no se valida contenedores (auto-LCL, opcional el número).
  if (input.tipoServicio === "LCL") return errors;

  // FCL: lista dinámica de contenedores.
  Object.assign(errors, validateContenedoresFcl(input.contenedores ?? []));
  return errors;
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
  return isoUtcDay(d);
}
