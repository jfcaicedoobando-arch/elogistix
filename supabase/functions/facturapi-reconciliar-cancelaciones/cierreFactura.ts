import type { SupabaseClient } from "npm:@supabase/supabase-js@2.119.0";
import type { AcuseResult, FacturaPendiente } from "./reconcile.ts";

export async function cerrarFacturaConAcuse(
  supabase: SupabaseClient,
  factura: Pick<FacturaPendiente, "id" | "organization_id">,
  acuse: AcuseResult,
  nowIso: string,
) {
  const patch = acuse.xml
    ? {
      acuse_cancelacion_status: acuse.status,
      acuse_cancelacion_xml: acuse.xml,
      acuse_cancelacion_fecha: nowIso,
    }
    : { acuse_cancelacion_status: acuse.status };
  const update = supabase.from("facturas").update(patch)
    .eq("id", factura.id).eq("organization_id", factura.organization_id).is(
      "deleted_at",
      null,
    );
  // Una consulta posterior sin XML no debe degradar un acuse ya respaldado.
  const { error: acuseError } =
    await (acuse.xml ? update : update.is("acuse_cancelacion_xml", null));
  if (acuseError) throw acuseError;

  const { data, error } = await supabase.rpc(
    "cerrar_cancelacion_factura_facturapi",
    {
      p_factura_id: factura.id,
    },
  );
  if (error) throw error;
  return data;
}
