/**
 * Bloque S — Cierre Financiero del Embarque.
 * Envoltorios a las RPCs `validar_cierre_embarque`, `cerrar_embarque`,
 * `reabrir_embarque_con_motivo` y lectura de `cierre_embarque_log`.
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
  usuario_email?: string | null;
  motivo: string | null;
  snapshot: Record<string, unknown> | null;
  created_at: string;
  origen?: "log" | "bitacora";
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

/**
 * A4 (v13.469.0) — se eliminó `reabrir_embarque_con_motivo`, que sólo saltaba
 * el candado de cierre y quedaba bloqueada por `trg_embarque_transicion_valida`.
 * Ahora el tab Cierre usa la RPC canónica `reabrir_embarque`, la misma que el
 * flujo de administración (mismo destino, roles e idempotencia).
 */
export async function reabrirEmbarque(
  embarqueId: string,
  motivo: string,
  /** @deprecated B-06: ignorado; el actor se deriva de la sesión en la BD. */
  _usuarioEmail?: string,
): Promise<void> {
  const { error } = await supabase.rpc("reabrir_embarque" as never, {
    p_embarque_id: embarqueId,
    // B-06: la RPC ignora este valor (era falsificable desde el cliente).
    p_usuario_email: "",
    p_motivo: motivo,
    p_request_id: crypto.randomUUID(),
  } as never);
  if (error) throw new Error(error.message);
}

export async function fetchCierreLog(embarqueId: string): Promise<CierreLogEntry[]> {
  const { data, error } = await supabase
    .from("cierre_embarque_log" as never)
    .select("id, embarque_id, accion, usuario_id, motivo, snapshot, created_at")
    .eq("embarque_id", embarqueId)
    .order("created_at", { ascending: false })
    // L1 (auditoría 3-3): desempate estable.
    .order("id", { ascending: false });
  if (error) throw new Error(error.message);
  const principal = (((data as unknown) as CierreLogEntry[]) ?? []).map((e) => ({
    ...e,
    origen: "log" as const,
  }));

  // Fallback: cierres/reaperturas históricos registrados solo en bitácora
  // (antes de que existiera cierre_embarque_log o ejecutados con UPDATE directo de estado).
  const { data: bitacora } = await supabase
    .from("bitacora_actividad")
    .select("id, usuario_id, usuario_email, accion, detalles, created_at")
    .eq("entidad_id", embarqueId)
    .eq("accion", "cambiar_estado")
    .order("created_at", { ascending: false })
    // L1 (auditoría 3-3): desempate estable.
    .order("id", { ascending: false });

  const fallback: CierreLogEntry[] = [];
  for (const row of (bitacora ?? []) as Array<{
    id: string;
    usuario_id: string | null;
    usuario_email: string | null;
    detalles: Record<string, unknown> | null;
    created_at: string;
  }>) {
    const det = (row.detalles ?? {}) as { estado_nuevo?: string; estado_anterior?: string };
    const nuevo = (det.estado_nuevo ?? "").toLowerCase();
    const anterior = (det.estado_anterior ?? "").toLowerCase();
    let accion: "cerrar" | "reabrir" | null = null;
    if (nuevo === "cerrado") accion = "cerrar";
    else if (anterior === "cerrado") accion = "reabrir";
    if (!accion) continue;
    fallback.push({
      id: `bit-${row.id}`,
      embarque_id: embarqueId,
      accion,
      usuario_id: row.usuario_id,
      usuario_email: row.usuario_email,
      motivo: null,
      snapshot: null,
      created_at: row.created_at,
      origen: "bitacora",
    });
  }


  // Evitar duplicar si ya hay un registro en cierre_embarque_log con el mismo timestamp aproximado.
  const principalKeys = new Set(
    principal.map((p) => `${p.accion}-${p.created_at.slice(0, 16)}`),
  );
  const fallbackUnico = fallback.filter(
    (f) => !principalKeys.has(`${f.accion}-${f.created_at.slice(0, 16)}`),
  );

  return [...principal, ...fallbackUnico].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
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
