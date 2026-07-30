/**
 * Detección de CFDI duplicado en la captura de facturas de proveedor.
 * v13.343.0 — antes el choque sólo aparecía al guardar (índice único
 * `ux_proveedor_facturas_uuid_fiscal_org`), sin decir cuál factura ya existía.
 */
import { buscarFacturaPorUuidFiscal, type FacturaExistentePorUuid } from "@/features/cxp/services";

export type { FacturaExistentePorUuid };

/** Texto legible: "FP-000123 · Vigente · aprobada". */
export function describirFacturaExistente(f: FacturaExistentePorUuid): string {
  const partes = [
    f.folio_interno ?? f.folio_proveedor ?? "sin folio",
    f.estado ?? undefined,
    f.estado_aprobacion ?? undefined,
  ].filter(Boolean) as string[];
  return partes.join(" · ");
}

/**
 * Devuelve la factura viva que ya usa ese UUID, o `null`.
 * Nunca lanza: si la consulta falla (red/RLS), el índice único sigue protegiendo.
 */
export async function detectarCfdiDuplicado(
  uuidFiscal: string | null | undefined,
): Promise<FacturaExistentePorUuid | null> {
  if (!uuidFiscal) return null;
  try {
    return await buscarFacturaPorUuidFiscal(uuidFiscal);
  } catch {
    return null;
  }
}
