/**
 * Candidatas para vincular un documento del buzón CxP con una factura de
 * proveedor ya capturada del mismo embarque.
 *
 * Se excluyen canceladas y borradas: no tiene sentido cerrar el documento
 * del buzón contra una factura que ya no existe fiscalmente.
 */
import { supabase } from "@/integrations/supabase/client";

export interface FacturaVinculable {
  id: string;
  folio_interno: string | null;
  folio_proveedor: string | null;
  proveedor_nombre: string | null;
  uuid_fiscal: string | null;
  total: number;
  moneda: string;
  fecha_emision: string | null;
  estado: string;
}

export async function listarFacturasVinculablesEntrante(
  embarqueId: string,
): Promise<FacturaVinculable[]> {
  const { data, error } = await supabase
    .from("proveedor_facturas")
    .select(
      "id, folio_interno, folio_proveedor, proveedor_nombre, uuid_fiscal, total, moneda, fecha_emision, estado",
    )
    .eq("embarque_id", embarqueId)
    .is("deleted_at", null)
    .neq("estado", "Cancelada")
    .order("fecha_emision", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((f) => ({
    id: f.id,
    folio_interno: f.folio_interno,
    folio_proveedor: f.folio_proveedor,
    proveedor_nombre: f.proveedor_nombre,
    uuid_fiscal: f.uuid_fiscal,
    total: Number(f.total ?? 0),
    moneda: String(f.moneda ?? "MXN"),
    fecha_emision: f.fecha_emision,
    estado: String(f.estado),
  }));
}

/** Etiqueta legible de una candidata para el selector. */
export function etiquetaFacturaVinculable(f: FacturaVinculable): string {
  const folio = f.folio_interno ?? f.folio_proveedor ?? "sin folio";
  const prov = f.proveedor_nombre ? ` · ${f.proveedor_nombre}` : "";
  return `${folio}${prov}`;
}
