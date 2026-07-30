/**
 * Detección de CFDI duplicado en la captura de facturas de proveedor.
 * v13.343.0 — antes el choque sólo aparecía al guardar (índice único
 * `ux_proveedor_facturas_uuid_fiscal_org`), sin decir cuál factura ya existía.
 * v13.368.0 — comparación insensible a mayúsculas y estado `error` explícito:
 * un fallo de consulta ya no se disfraza de "no hay duplicado".
 */
import {
  buscarFacturaPorUuidFiscalResultado,
  type BusquedaUuidFiscal,
  type FacturaExistentePorUuid,
} from "@/features/cxp/services";

export type { FacturaExistentePorUuid, BusquedaUuidFiscal };

/** Texto legible: "FP-000123 · Vigente · aprobada". */
export function describirFacturaExistente(f: FacturaExistentePorUuid): string {
  const partes = [
    f.folio_interno ?? f.folio_proveedor ?? "sin folio",
    f.estado ?? undefined,
    f.estado_aprobacion ?? undefined,
  ].filter(Boolean) as string[];
  return partes.join(" · ");
}

/** Resultado completo de la búsqueda (nunca lanza). */
export async function buscarCfdiDuplicado(
  uuidFiscal: string | null | undefined,
): Promise<BusquedaUuidFiscal> {
  if (!uuidFiscal) return { estado: "ninguno" };
  try {
    return await buscarFacturaPorUuidFiscalResultado(uuidFiscal);
  } catch {
    return { estado: "error" };
  }
}

/**
 * Devuelve la factura viva que ya usa ese UUID, o `null`.
 * Nunca lanza: si la consulta falla, el índice único sigue protegiendo.
 */
export async function detectarCfdiDuplicado(
  uuidFiscal: string | null | undefined,
): Promise<FacturaExistentePorUuid | null> {
  const r = await buscarCfdiDuplicado(uuidFiscal);
  return r.estado === "existe" ? r.factura : null;
}
