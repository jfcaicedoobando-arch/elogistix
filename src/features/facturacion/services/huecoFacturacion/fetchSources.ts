/**
 * Fuentes de datos (Supabase) para el "Hueco de Facturación". Solo I/O.
 *
 * v13.213.3 — Se agrega `fetchConceptosVentaDeEmbarques` para detectar
 * "aceptación histórica": embarques cuyos conceptos ya viven en proformas
 * marcadas como `facturada` (back-fill), que deben excluirse del hueco aunque
 * no exista CFDI real.
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchFacturasPorExpedientes } from "@/features/facturacion/services/shared/fetchFacturas";

export interface EmbarqueHuecoRow {
  id: string;
  expediente: string | null;
  cliente_nombre: string | null;
  operador: string | null;
  etd: string | null;
  eta: string | null;
  bl_master: string | null;
  bl_house: string | null;
  tipo_cambio_usd: number | null;
  tipo_cambio_eur: number | null;
}

export interface ConceptoVentaDetalle {
  embarque_id: string;
  estado_facturacion: string | null;
  proforma_id: string | null;
  proforma_estado: string | null;
}

export async function fetchEmbarquesParaHueco(
  organizationId: string | null,
  limiteIso: string,
): Promise<EmbarqueHuecoRow[]> {
  let q = supabase
    .from("embarques")
    .select(
      "id, expediente, cliente_nombre, operador, etd, eta, bl_master, bl_house, tipo_cambio_usd, tipo_cambio_eur",
    )
    .not("etd", "is", null)
    .lte("etd", limiteIso)
    .order("etd", { ascending: true });
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/**
 * Trae conceptos_venta no borrados de los embarques dados, junto con el
 * `estado_proforma` de su proforma padre (si existe). Usado para detectar
 * cobertura por aceptación histórica.
 */
export async function fetchConceptosVentaDeEmbarques(
  ids: string[],
): Promise<ConceptoVentaDetalle[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("conceptos_venta")
    .select("embarque_id, estado_facturacion, proforma_id, proformas(estado_proforma, deleted_at)")
    .in("embarque_id", ids)
    .is("deleted_at", null);
  if (error) throw error;
  type Row = {
    embarque_id: string;
    estado_facturacion: string | null;
    proforma_id: string | null;
    proformas: { estado_proforma: string | null; deleted_at: string | null } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  return rows.map((r) => ({
    embarque_id: r.embarque_id,
    estado_facturacion: r.estado_facturacion,
    proforma_id: r.proforma_id,
    proforma_estado:
      r.proformas && !r.proformas.deleted_at ? r.proformas.estado_proforma : null,
  }));
}

export async function fetchVentasYFacturas(ids: string[], expedientes: string[]) {
  const [ventasRes, facturas, conceptosDetalle] = await Promise.all([
    supabase.from("conceptos_venta").select("embarque_id, total, moneda").in("embarque_id", ids),
    fetchFacturasPorExpedientes(expedientes),
    fetchConceptosVentaDeEmbarques(ids),
  ]);
  if (ventasRes.error) throw ventasRes.error;
  return { ventas: ventasRes.data ?? [], facturas, conceptosDetalle };
}
