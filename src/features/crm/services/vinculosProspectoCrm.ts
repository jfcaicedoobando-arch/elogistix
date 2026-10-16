import { supabase } from "@/integrations/supabase/client";
import type { VinculosProspecto } from "../domain/pasarEmpresaAProspecto";

/** get_user_context.orgRole puede pertenecer a otra membresía: resolver la del tenant exacto. */
export async function fetchMembresiaProspecto(userId: string, organizationId: string) {
  const { data, error } = await supabase.from("organization_members")
    .select("role, organization_id, organizations(activo)")
    .eq("user_id", userId).eq("organization_id", organizationId).maybeSingle();
  if (error) throw error;
  return data;
}

/** No filtrar borrados ni usar !inner: una referencia invisible o borrada debe impedir el permiso. */
export async function fetchVinculosProspecto(empresaId: string, leadId: string | null): Promise<VinculosProspecto> {
  const [lead, oportunidades] = await Promise.all([
    leadId ? supabase.from("crm_leads") // SOFT-DELETE-OK: el permiso debe detectar y rechazar el lead borrado.
      .select("id, organization_id, vendedor_id, deleted_at, estado, cliente_convertido_id")
      .eq("id", leadId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("crm_oportunidad_empresa")
      .select("organization_id, crm_oportunidades(id, organization_id, vendedor_id, deleted_at, lead_id)", { count: "exact" })
      .eq("empresa_id", empresaId),
  ]);
  if (lead.error) throw lead.error;
  if (oportunidades.error) throw oportunidades.error;
  if (oportunidades.count === null || oportunidades.count !== (oportunidades.data?.length ?? 0)) {
    throw new Error("No se pudieron verificar todos los vínculos de la empresa");
  }
  return { lead: lead.data, oportunidades: oportunidades.data ?? [] };
}
