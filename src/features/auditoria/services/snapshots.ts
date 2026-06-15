import { supabase } from "@/integrations/supabase/client";
import type { AuditoriaSnapshot } from "@/features/auditoria/types";

/**
 * Lista snapshots de auditoría de los últimos `dias` (UTC).
 * El cálculo del rango usa aritmética sobre `Date.now()` (UTC) para evitar
 * drift en runtimes con TZ local (ej. CDMX cerca de medianoche).
 */
export async function fetchAuditoriaSnapshots(
  dias = 30,
): Promise<AuditoriaSnapshot[]> {
  const desdeIso = new Date(Date.now() - dias * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data, error } = await supabase
    .from("auditoria_snapshots")
    .select("*")
    .gte("fecha", desdeIso)
    .order("fecha", { ascending: true })
    .limit(2000); // defensivo: cap por org (snapshots diarios → años de margen)
  if (error) throw error;
  return (data ?? []) as AuditoriaSnapshot[];
}

export async function capturarSnapshotAuditoria(): Promise<void> {
  const { error } = await supabase.rpc("auditoria_capturar_snapshot");
  if (error) throw error;
}
