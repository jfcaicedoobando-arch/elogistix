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