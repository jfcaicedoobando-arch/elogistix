import { supabase } from "@/integrations/supabase/client";
import type { AuditoriaSnapshot } from "@/features/auditoria/types";
import { registrarActividad } from "@/services/bitacora/registrar";

export interface FetchSnapshotsOpts {
  dias?: number;
  /** Defensa en profundidad: filtra por organización en cliente además de RLS. */
  organizationId?: string | null;
}

/**
 * Lista snapshots de auditoría de los últimos `dias` (UTC).
 * El cálculo del rango usa aritmética sobre `Date.now()` (UTC) para evitar
 * drift en runtimes con TZ local (ej. CDMX cerca de medianoche).
 */
export async function fetchAuditoriaSnapshots(
  diasOrOpts: number | FetchSnapshotsOpts = 30,
): Promise<AuditoriaSnapshot[]> {
  const opts: FetchSnapshotsOpts =
    typeof diasOrOpts === "number" ? { dias: diasOrOpts } : diasOrOpts;
  const dias = opts.dias ?? 30;
  const desdeIso = new Date(Date.now() - dias * 86_400_000)
    .toISOString()
    .slice(0, 10);
  let q = supabase
    .from("auditoria_snapshots")
    .select("*")
    .gte("fecha", desdeIso)
    .order("fecha", { ascending: true })
    .limit(2000); // defensivo: cap por org (snapshots diarios → años de margen)
  if (opts.organizationId) q = q.eq("organization_id", opts.organizationId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AuditoriaSnapshot[];
}

/**
 * Captura snapshot del día para la organización dada.
 * 13.141.6: la firma del RPC en BD es `auditoria_capturar_snapshot(p_organization_id uuid)`.
 * Antes el cliente llamaba sin args y PostgREST devolvía PGRST202.
 */
export async function capturarSnapshotAuditoria(organizationId: string): Promise<void> {
  if (!organizationId) {
    throw new Error("organizationId requerido para capturar snapshot de auditoría");
  }
  const { error } = await supabase.rpc("auditoria_capturar_snapshot", {
    p_organization_id: organizationId,
  });
  if (error) throw error;
  await registrarActividad({
    modulo: "auditoria",
    accion: "Capturó snapshot de auditoría",
    entidadId: organizationId,
  });
}
