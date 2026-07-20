/**
 * Dispatcher de validación por paso del wizard "Nuevo Embarque".
 * Extraído de `useNuevoEmbarqueWizard` (11.14.0).
 *
 * `values` se tipa como `unknown` y se reinterpreta dentro porque la
 * forma exacta vive en `useEmbarqueForm` (acoplado a RHF) y duplicarla
 * aquí generaría drift. Los validadores zod hacen el chequeo real.
 */
import {
  validateStepDatosGenerales,
  validateStepRuta,
  validateStepDocumentos,
  validateStepCostos,
  type StepRutaInput,
  type StepValidationErrors,
  type ConceptoVentaValidacion,
  type ConceptoCostoValidacion,
} from "@/features/embarques/domain/embarqueWizardSchemas";

export interface ValidateStepInput {
  step: number;
  values: unknown;
  documentosArchivos: Record<string, File>;
  conceptosVenta: ConceptoVentaValidacion[];
  conceptosCosto: ConceptoCostoValidacion[];
  /**
   * v13.303.26: siempre obligatorio para step 1. Se mantiene el flag para no
   * romper llamadas y para permitir tests que aíslan validaciones base sin
   * exigir la cotización. Default `true` (política tarifa-first).
   */
  requiereCotizacion?: boolean;
  /** Id de la cotización vinculada en el wizard (si existe). */
  cotizacionVinculadaId?: string | null;
}

interface StepCostosValues {
  tipoCambioUSD?: string | number;
  tipoCambioEUR?: string | number;
}

export function validateWizardStep(input: ValidateStepInput): StepValidationErrors {
  const {
    step, values, documentosArchivos, conceptosVenta, conceptosCosto,
    requiereCotizacion = true, cotizacionVinculadaId = null,
  } = input;

  if (step === 1) {
    const errors = validateStepDatosGenerales(values as Parameters<typeof validateStepDatosGenerales>[0]);
    if (requiereCotizacion && !cotizacionVinculadaId) {
      errors.cotizacion = "Debes iniciar el embarque desde una cotización Aceptada.";
    }
    return errors;
  }

  if (step === 2) {
    return validateStepRuta(values as StepRutaInput);
  }
  if (step === 3) {
    const archivos: Record<string, { size: number; type: string }> = {};
    for (const [nombre, file] of Object.entries(documentosArchivos)) {
      archivos[nombre] = { size: file.size, type: file.type };
    }
    return validateStepDocumentos(archivos);
  }
  if (step === 4) {
    const v = (values ?? {}) as StepCostosValues;
    return validateStepCostos({
      conceptosVenta,
      conceptosCosto,
      tipoCambioUSD: v.tipoCambioUSD ?? 0,
      tipoCambioEUR: v.tipoCambioEUR ?? 0,
    });
  }
  return {};
}
