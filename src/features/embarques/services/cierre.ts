/**
 * Bloque S — Cierre Financiero del Embarque.
 * Envoltorios a las RPCs `validar_cierre_embarque`, `cerrar_embarque`,
 * `reabrir_embarque` y lectura de `cierre_embarque_log`.
 */
import { supabase } from "@/integrations/supabase/client";

export type ReglaCierre =
  | "cxc_sin_pendientes"
  | "cxp_sin_pendientes"
  | "documentos_completos"
  | "pnl_margen_minimo"
  | "comision_calculada";

export interface CierreCheck {
  regla: ReglaCierre;
  ok: boolean;
  detalle?: Record<string, unknown>;
}

export interface CierreValidacion {
  puede_cerrar: boolean;
  estatus_actual?: string;
  cerrado?: boolean;
  checks: CierreCheck[];
  error?: string;
}

export interface CierreLogEntry {
  id: string;
  embarque_id: string;
  accion: "cerrar" | "reabrir";
  usuario_id: string | null;
  motivo: string | null;
  snapshot: Record<string, unknown> | null;
  created_at: string;
}

export async function validarCierre(embarqueId: string): Promise<CierreValidacion> {
  // SAFE-CAST: RPC tipada como Json en types.ts generados.
  const { data, error } = await supabase.rpc("validar_cierre_embarque" as never, {
    p_embarque_id: embarqueId,
  } as never);
  if (error) throw new Error(error.message);
  return (data as unknown) as CierreValidacion;
}

export async function cerrarEmbarque(embarqueId: string): Promise<void> {
  const { error } = await supabase.rpc("cerrar_embarque" as never, {
    p_embarque_id: embarqueId,
  } as never);
  if (error) throw new Error(error.message);
}

export async function reabrirEmbarque(embarqueId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc("reabrir_embarque" as never, {
    p_embarque_id: embarqueId,
    p_motivo: motivo,
  } as never);
  if (error) throw new Error(error.message);
}

export async function fetchCierreLog(embarqueId: string): Promise<CierreLogEntry[]> {
  const { data, error } = await supabase
    .from("cierre_embarque_log" as never)
    .select("id, embarque_id, accion, usuario_id, motivo, snapshot, created_at")
    .eq("embarque_id", embarqueId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as unknown) as CierreLogEntry[]) ?? [];
}

// ============================================================
// v13.89.0 — Cierre administrativo: resumen por embarque y conteo global
// ============================================================

export interface AdminPendientesResumen {
  pendientes: number;
  cxc_pendiente: number;
  cxp_pendiente: number;
  docs_faltantes: number;
  venta_no_facturada: number;
}

export async function fetchAdminPendientesResumen(embarqueId: string): Promise<AdminPendientesResumen> {
  // SAFE-CAST: RPC nueva tipada como Json en types.ts hasta regeneración.
  const { data, error } = await supabase.rpc("embarque_admin_pendientes_resumen" as never, {
    p_embarque_id: embarqueId,
  } as never);
  if (error) throw new Error(error.message);
  const raw = (data ?? {}) as Partial<AdminPendientesResumen>;
  return {
    pendientes: Number(raw.pendientes ?? 0),
    cxc_pendiente: Number(raw.cxc_pendiente ?? 0),
    cxp_pendiente: Number(raw.cxp_pendiente ?? 0),
    docs_faltantes: Number(raw.docs_faltantes ?? 0),
    venta_no_facturada: Number(raw.venta_no_facturada ?? 0),
  };
}

export async function fetchAdminPendientesCount(): Promise<number> {
  // SAFE-CAST: RPC nueva no tipada aún.
  const { data, error } = await supabase.rpc("embarques_admin_pendientes_count" as never);
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}
