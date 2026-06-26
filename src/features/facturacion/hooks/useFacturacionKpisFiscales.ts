/**
 * Hook de KPIs fiscales pendientes (Fase 6 del plan FacturApi).
 *
 * - Proformas convertibles: estado=Aprobada y sin factura_id.
 * - Facturas sin timbrar:   estado=Borrador y facturapi_id IS NULL.
 * - REPs pendientes:        pagos_factura con estado_rep IN ('Pendiente','Error').
 *
 * Sólo cuenta filas; no descarga payload pesado.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/lib/contexts/OrganizationContext";

export interface FacturacionKpisFiscales {
  proformasConvertibles: number;
  facturasSinTimbrar: number;
  repsPendientes: number;
}

async function fetchKpis(orgId: string): Promise<FacturacionKpisFiscales> {
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

export function useFacturacionKpisFiscales() {
  const { organization } = useOrganization();
  const orgId = organization?.id ?? null;
  return useQuery({
    queryKey: ["facturacion-kpis-fiscales", orgId],
    queryFn: () => fetchKpis(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
  });
}
