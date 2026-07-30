/**
 * Consulta por lotes de UUID fiscales ya capturados como factura de proveedor.
 *
 * v13.368.0 — El buzón CxP marca los documentos cuyo CFDI ya existe para no
 * dejar que el contador llene un formulario que la base de datos va a rechazar.
 */
import { supabase } from "@/integrations/supabase/client";
import { normalizarUuidFiscal } from "@/lib/domain/uuidFiscal";

export interface FacturaPorUuid {
  id: string;
  folio_interno: string | null;
}

/** Mapa `UUID normalizado -> factura viva`. Devuelve vacío si la consulta falla. */
export async function buscarFacturasPorUuidsFiscales(
  uuids: ReadonlyArray<string | null | undefined>,
): Promise<Map<string, FacturaPorUuid>> {
  const lista = Array.from(
    new Set(uuids.map(normalizarUuidFiscal).filter((u): u is string => u !== null)),
  );
  const mapa = new Map<string, FacturaPorUuid>();
  if (lista.length === 0) return mapa;

  const { data, error } = await supabase
    .from("proveedor_facturas")
    .select("id, folio_interno, uuid_fiscal")
    .in("uuid_fiscal", lista)
    .is("deleted_at", null);
  if (error || !data) return mapa;

  for (const row of data) {
    const key = normalizarUuidFiscal(row.uuid_fiscal);
    if (key && !mapa.has(key)) mapa.set(key, { id: row.id, folio_interno: row.folio_interno });
  }
  return mapa;
}
