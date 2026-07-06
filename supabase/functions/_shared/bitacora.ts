/**
 * Helper compartido para insertar en `bitacora_actividad` desde edge functions.
 * Estandariza el shape correcto (`usuario_id`, `usuario_email`, `modulo`,
 * `entidad_nombre`) — versiones anteriores en varias functions usaban nombres
 * de columna incorrectos (`user_id`, `entidad`) y los inserts fallaban
 * silenciosamente.
 *
 * Todas las llamadas son best-effort: si la escritura falla, se emite un
 * `console.warn` pero no rompe el flujo del edge function.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = { from(table: string): { insert(row: any): Promise<{ error: unknown }> } };

export interface EdgeBitacoraInput {
  organizationId: string | null;
  usuarioId: string | null;
  usuarioEmail?: string | null;
  modulo: "facturacion" | "cotizaciones" | "proformas" | "cxp" | "costeo" | "auth" | "usuarios";
  accion: string;
  entidadId?: string | null;
  entidadNombre?: string | null;
  detalles?: Record<string, unknown>;
}

/** UUID cero para eventos de sistema (webhook) donde no hay usuario. */
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function registrarBitacoraEdge(
  supabase: SupabaseLike,
  input: EdgeBitacoraInput,
): Promise<void> {
  try {
    const { error } = await supabase.from("bitacora_actividad").insert({
      organization_id: input.organizationId,
      usuario_id: input.usuarioId ?? SYSTEM_USER_ID,
      usuario_email: input.usuarioEmail ?? "system@edge",
      modulo: input.modulo,
      accion: input.accion,
      entidad_id: input.entidadId ?? null,
      entidad_nombre: input.entidadNombre ?? "",
      detalles: input.detalles ?? {},
    });
    if (error) {
       
      console.warn("[bitacora-edge] insert falló:", error);
    }
  } catch (err) {
     
    console.warn("[bitacora-edge] excepción:", err);
  }
}
