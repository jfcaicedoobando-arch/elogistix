import type { PnlCoberturaSeguros, PnlDocumentacionCostos, PnlDocumentacionIngresos } from "./pnlFinanciero";

/** An old/partial payload cannot establish that insurance coverage was checked. */
export function normalizarCobertura(raw: unknown): PnlCoberturaSeguros | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const keys = ["vinculados", "completos", "inconsistentes", "sin_atribucion",
    "asignacion_indeterminada", "sin_valoracion", "insuficientes"] as const;
  if (row.evaluada !== true || keys.some((key) =>
    typeof row[key] !== "number" || !Number.isSafeInteger(row[key]) || row[key] < 0)) return null;
  // SAFE-CAST: every aggregate field is checked above before consuming diagnostics.
  const coverage = row as unknown as PnlCoberturaSeguros;
  if (coverage.completos + coverage.inconsistentes !== coverage.vinculados
    || coverage.sin_atribucion + coverage.asignacion_indeterminada
      + coverage.sin_valoracion + coverage.insuficientes !== coverage.inconsistentes) return null;
  return coverage;
}

/** Presence must be checked explicitly; a legacy response cannot confirm it. */
export function normalizarDocumentacion(raw: unknown): PnlDocumentacionCostos | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const keys = ["conceptos", "documentados", "sin_documentar"] as const;
  if (row.evaluada !== true || keys.some((key) =>
    typeof row[key] !== "number" || !Number.isSafeInteger(row[key]) || row[key] < 0)) return null;
  // SAFE-CAST: every count is checked above before consuming diagnostics.
  const documentation = row as unknown as PnlDocumentacionCostos;
  if (documentation.documentados + documentation.sin_documentar !== documentation.conceptos) return null;
  return documentation;
}

/** No inferir evaluación desde importes ni convertir documentos desconocidos a cero. */
export function normalizarIngresos(raw: unknown): PnlDocumentacionIngresos | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const keys = ["facturas", "notas_credito_activas", "notas_credito_sin_base",
    "notas_credito_sin_valoracion", "facturas_sin_valoracion", "repartos_provisionales", "desbordamientos"] as const;
  if (row.evaluada !== true || keys.some((key) =>
    typeof row[key] !== "number" || !Number.isSafeInteger(row[key]) || row[key] < 0)) return null;
  // SAFE-CAST: all diagnostic fields have been checked before this cross-count validation.
  const doc = row as unknown as PnlDocumentacionIngresos;
  if ((doc.facturas === 0 && doc.notas_credito_activas > 0)
    || doc.facturas_sin_valoracion > doc.facturas
    || doc.notas_credito_sin_base + doc.notas_credito_sin_valoracion > doc.notas_credito_activas
    || doc.repartos_provisionales > Math.min(doc.facturas, doc.notas_credito_activas)) return null;
  return doc;
}

export function ingresosVerificados(doc: PnlDocumentacionIngresos | null): boolean {
  return doc !== null && doc.notas_credito_sin_base === 0 && doc.notas_credito_sin_valoracion === 0
    && doc.facturas_sin_valoracion === 0 && doc.repartos_provisionales === 0 && doc.desbordamientos === 0;
}
