import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import type { ReporteAuditoria } from "@/types/auditoria";

export async function fetchReporteAuditoria(): Promise<ReporteAuditoria> {
  const { data, error } = await supabase.rpc("auditoria_embarques_org");
  if (error) throw error;
  return fromDb<ReporteAuditoria>(data);
}
