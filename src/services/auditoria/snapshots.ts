import { supabase } from "@/integrations/supabase/client";
import type { AuditoriaSnapshot } from "@/types/auditoria";

export async function fetchAuditoriaSnapshots(
  dias = 30,
): Promise<AuditoriaSnapshot[]> {
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const desdeIso = desde.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("auditoria_snapshots")
    .select("*")
    .gte("fecha", desdeIso)
    .order("fecha", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AuditoriaSnapshot[];
}

export async function capturarSnapshotAuditoria(): Promise<void> {
  const { error } = await supabase.rpc("auditoria_capturar_snapshot");
  if (error) throw error;
}
