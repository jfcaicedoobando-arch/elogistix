/**
 * Dispatcher de validación por paso del wizard "Nuevo Embarque".
 * Extraído de `useNuevoEmbarqueWizard` (11.14.0).
 */
import {
  validateStepDatosGenerales,
  validateStepRuta,
  validateStepDocumentos,
  validateStepCostos,
  type StepValidationErrors,
} from "@/lib/domain/embarqueWizardSchemas";

export interface ValidateStepInput {
  step: number;
  values: Record<string, unknown> & {
    tipoCambioUSD?: number;
    tipoCambioEUR?: number;
  };
  documentosArchivos: Record<string, File>;
  conceptosVenta: Array<{
    id: string;
    concepto: string;
    cantidad: number;
    precioUnitario: number;
    moneda: string;
  }>;
  conceptosCosto: Array<{
    id: string;
    proveedorId: string | null;
    concepto: string;
    monto: number;
    moneda: string;
  }>;
}

export function validateWizardStep(input: ValidateStepInput): StepValidationErrors {
  const { step, values, documentosArchivos, conceptosVenta, conceptosCosto } = input;

  if (step === 1) {
    return validateStepDatosGenerales(values);
  }
  if (step === 2) {
    return validateStepRuta(values);
  }
  if (step === 3) {
    const archivos: Record<string, { size: number; type: string }> = {};
    for (const [nombre, file] of Object.entries(documentosArchivos)) {
      archivos[nombre] = { size: file.size, type: file.type };
    }
    return validateStepDocumentos(archivos);
  }
  if (step === 4) {
    return validateStepCostos({
      conceptosVenta: conceptosVenta.map((v) => ({
        id: v.id,
        concepto: v.concepto,
        cantidad: v.cantidad,
        precioUnitario: v.precioUnitario,
        moneda: v.moneda,
      })),
      conceptosCosto: conceptosCosto.map((c) => ({
        id: c.id,
        proveedorId: c.proveedorId,
        concepto: c.concepto,
        monto: c.monto,
        moneda: c.moneda,
      })),
      tipoCambioUSD: values.tipoCambioUSD,
      tipoCambioEUR: values.tipoCambioEUR,
    });
  }
  return {};
}
