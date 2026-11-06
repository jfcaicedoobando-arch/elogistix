import { supabase } from "@/integrations/supabase/client";
import { unwrap } from "@/lib/supabase/response";

export async function fetchHandover(cotizacionId: string, organizationId: string) {
  return unwrap(
    supabase.from("cotizacion_handovers")
      .select("id, cotizacion_id, organization_id, coordinador_id, created_at")
      .eq("cotizacion_id", cotizacionId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
  );
}
export async function fetchHandoverProveedores(organizationId: string, agenteId: string | null | undefined, navieraId: string | null | undefined) {
  const [agente, naviera] = await Promise.all([
    agenteId ? unwrap(supabase.from("costeo_agentes").select("nombre").eq("id", agenteId).eq("organization_id", organizationId).maybeSingle()) : null,
    navieraId ? unwrap(supabase.from("navieras").select("name").eq("id", navieraId).maybeSingle()) : null,
  ]);
  return { agente: agente?.nombre ?? null, naviera: naviera?.name ?? null };
}
