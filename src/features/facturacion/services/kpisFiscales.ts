/**
 * Servicio: KPIs fiscales pendientes (Fase 6 plan FacturApi).
 * Sólo conteos; sin payload pesado.
 */
import { supabase } from "@/integrations/supabase/client";

export interface FacturacionKpisFiscales {
  proformasConvertibles: number;
  facturasSinTimbrar: number;
  repsPendientes: number;
}

export async function fetchFacturacionKpisFiscales(
  orgId: string,
): Promise<FacturacionKpisFiscales> {
  const [proformas, facturas, reps] = await Promise.all([
    supabase
      .from("proformas")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("estado_proforma", "aprobada")
      .is("factura_id", null),
    supabase
      .from("facturas")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("estado", "Borrador")
      .is("facturapi_id", null),
    supabase
      .from("pagos_factura")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("estado_rep", ["Pendiente", "Error"]),
  ]);

  return {
    proformasConvertibles: proformas.count ?? 0,
    facturasSinTimbrar: facturas.count ?? 0,
    repsPendientes: reps.count ?? 0,
  };
}
