/**
 * Helpers de métodos de pago a proveedor según origen (Nacional / Extranjero).
 *
 * - SPEI: transferencia interbancaria en MXN (México).
 * - SPID: Sistema de Pagos Interbancarios en Dólares (USD entre bancos en México).
 */
export const METODOS_NACIONAL = ["SPEI", "SPID", "Transferencia", "Cheque", "Efectivo", "Tarjeta", "Otro"] as const;
export const METODOS_EXTRANJERO = ["SPID", "Transferencia internacional", "Transferencia", "Cheque", "Otro"] as const;

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
  if (metodo === "SPID") return "Clave de rastreo SPID (USD)";
  if (metodo === "Transferencia internacional") return "Referencia SWIFT / MT103";
  if (metodo === "Cheque") return "Número de cheque";
  return "Folio bancario, número de cheque…";
}
