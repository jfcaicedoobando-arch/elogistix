/** Contrato de la migración histórica 0022_refacturar_proforma_abre_edicion. */
export interface RefacturarResultado {
  embarque_id: string;
  anterior_numero: string;
  factura_cancelada: string;
  conceptos: string[];
  notas_sugeridas: string;
}

function esResultadoRefacturacion(value: unknown): value is RefacturarResultado {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<RefacturarResultado>; // SAFE-CAST: se validan todos los campos abajo.
  return typeof r.embarque_id === "string" && r.embarque_id.length > 0
    && typeof r.anterior_numero === "string" && typeof r.factura_cancelada === "string"
    && typeof r.notas_sugeridas === "string" && Array.isArray(r.conceptos)
    && r.conceptos.length > 0 && r.conceptos.every((id) => typeof id === "string" && id.length > 0);
}

export function leerResultadoRefacturacion(value: unknown): RefacturarResultado {
  if (!esResultadoRefacturacion(value)) {
    throw new Error("Respuesta de refacturación incompatible. Revisa el embarque antes de reintentar: la proforma anterior puede haber quedado cancelada.");
  }
  return value;
}

export function leerRefacturacionNavState(state: unknown): RefacturarResultado | null {
  if (!state || typeof state !== "object" || !("refacturacion" in state)) return null;
  return esResultadoRefacturacion(state.refacturacion) ? state.refacturacion : null;
}
