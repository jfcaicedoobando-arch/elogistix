import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsonResponse } from "../_shared/response.ts";
import type { FacturaRow } from "./types.ts";

/** Cabecera y orígenes por línea: una fusión también puede tener varios históricos. */
export async function validarProformasVigentes(supabase: SupabaseClient, factura: FacturaRow): Promise<Response | null> {
  const { data: conceptos, error: cErr } = await supabase.from("conceptos_factura")
    .select("proforma_id_origen").eq("factura_id", factura.id)
    .eq("organization_id", factura.organization_id).is("deleted_at", null);
  if (cErr) return jsonResponse({ error: "proformas_query_failed", message: "No se pudo verificar el origen de la factura." }, 500);
  const ids = [...new Set([factura.proforma_id, ...(conceptos ?? []).map((c: { proforma_id_origen: string | null }) => c.proforma_id_origen)].filter((id): id is string => !!id))];
  if (ids.length === 0) return null;
  const { data: proformas, error } = await supabase.from("proformas")
    .select("id, estado_proforma").in("id", ids)
    .eq("organization_id", factura.organization_id).is("deleted_at", null);
  if (error) return jsonResponse({ error: "proformas_query_failed", message: "No se pudo verificar la proforma de origen." }, 500);
  if (proformas?.some((p: { estado_proforma: string }) => p.estado_proforma === "cancelada")) {
    return jsonResponse({ error: "LC_PROFORMA_CANCELADA", message: "Crea una nueva proforma para refacturar; el histórico cancelado no se puede timbrar." }, 409);
  }
  if (proformas?.length !== ids.length) return jsonResponse({ error: "proforma_no_disponible", message: "Una proforma de origen no está disponible para timbrar." }, 409);
  return null;
}
