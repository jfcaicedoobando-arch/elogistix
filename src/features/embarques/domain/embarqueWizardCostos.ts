/**
 * Validación pura del paso 4 del wizard (costos/precios).
 *
 * NOTA: este módulo NO calcula totales. Toda aritmética monetaria
 * (subtotales, IVA, KPIs) debe usar `sumarSubtotales`/`sumarMontos` de
 * `@/lib/financial/financialUtils` y `computeEmbarqueKpis` de
 * `@/features/embarques/domain/embarqueKpis` — ambos envuelven `currency.js` con
 * redondeo a 2 decimales por fila para coincidir exactamente con los
 * registros de pago en `DialogRegistrarPago`. No reintroducir aquí sumas
 * planas tipo `reduce((s, c) => s + c.cantidad * c.precioUnitario, 0)`.
 */
import { msg, getMessage } from "@/lib/domain/errorCatalog";
import type { StepValidationErrors } from "./embarqueWizardSchemas";

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

function validarConceptosVenta(ventas: ConceptoVentaValidacion[], errors: StepValidationErrors): void {
  const validos = ventas.filter((v) => v.concepto.trim() && v.precioUnitario > 0 && v.cantidad >= 1);
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

function validarConceptosCosto(costos: ConceptoCostoValidacion[], errors: StepValidationErrors): void {
  const validos = costos.filter((c) => c.concepto.trim() && c.proveedorId && c.monto >= 0);
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
