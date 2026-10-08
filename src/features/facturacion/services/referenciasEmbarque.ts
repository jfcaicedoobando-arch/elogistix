/** Lecturas de referencias para la revisión previa; no muta datos fiscales. */
import { supabase } from "@/integrations/supabase/client";
import {
  resolverReferenciasPreview,
  type FacturaReferenciasInput,
  type ReferenciasEmbarqueFactura,
  type ReferenciasFacturaPreview,
} from "../domain/referenciasFacturaPreview";

interface EmbarqueReferenciasRow extends ReferenciasEmbarqueFactura { id: string }

async function fetchReferenciasEmbarques(
  organizationId: string,
  ids: string[],
): Promise<EmbarqueReferenciasRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("embarques")
    .select("id, expediente, bl_master, bl_house")
    .eq("organization_id", organizationId)
    .in("id", ids)
    .is("deleted_at", null);
  if (error) throw error;
  return data ?? [];
}

export async function fetchReferenciasFacturaPreview(
  factura: FacturaReferenciasInput,
  organizationId: string,
): Promise<ReferenciasFacturaPreview> {
  // Una factura cacheada de otra organización nunca habilita lecturas ni fallback.
  if (!factura.id || !organizationId || factura.organization_id !== organizationId) {
    throw new Error("No se pudo verificar la organización de la factura.");
  }
  const { data, error } = await supabase.from("conceptos_factura")
    .select("id, descripcion, embarque_id")
    .eq("organization_id", organizationId)
    .eq("factura_id", factura.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  const conceptos = data ?? [];
  const ids = [...new Set(conceptos.flatMap((c) => c.embarque_id ? [c.embarque_id] : []))];
  // Edge143 sólo usa la cabecera si no existe ningún vínculo por concepto.
  if (conceptos.length > 0 && ids.length === 0 && factura.embarque_id) ids.push(factura.embarque_id);
  const embarques = await fetchReferenciasEmbarques(organizationId, ids);
  // Origen invisible, borrado o fuera de scope: no afirmar qué referencia emitirá
  // Edge (su consulta puede tener mayor visibilidad), ni heredar la cabecera.
  return resolverReferenciasPreview(factura, conceptos, embarques);
}
