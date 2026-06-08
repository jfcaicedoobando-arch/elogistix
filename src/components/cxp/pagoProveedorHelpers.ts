/**
 * Helpers de métodos de pago a proveedor según origen (Nacional / Extranjero).
 */
export const METODOS_NACIONAL = ["SPEI", "Transferencia", "Cheque", "Efectivo", "Tarjeta", "Otro"] as const;
export const METODOS_EXTRANJERO = ["Transferencia internacional", "Transferencia", "Cheque", "Otro"] as const;

export type OrigenProveedor = "Nacional" | "Extranjero" | null;

export function metodosFor(origen: OrigenProveedor): readonly string[] {
  if (origen === "Extranjero") return METODOS_EXTRANJERO;
  return METODOS_NACIONAL;
}

export function defaultMetodo(origen: OrigenProveedor): string {
  if (origen === "Extranjero") return "Transferencia internacional";
  if (origen === "Nacional") return "SPEI";
  return "Transferencia";
}

export function referenciaHint(metodo: string): string {
  if (metodo === "SPEI") return "Clave de rastreo SPEI (18 dígitos)";
  if (metodo === "Transferencia internacional") return "Referencia SWIFT / MT103";
  if (metodo === "Cheque") return "Número de cheque";
  return "Folio bancario, número de cheque…";
}
