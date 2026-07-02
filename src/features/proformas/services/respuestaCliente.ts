/**
 * Servicio: respuesta del cliente sobre una proforma.
 *
 * Expone dos RPCs (SECURITY DEFINER en DB):
 *  - `portal_responder_proforma`: usado por el portal del cliente (autenticado
 *    como usuario del portal, filtrado por `current_user_client_ids()`).
 *  - `actualizar_estado_cliente_proforma`: fallback manual para el equipo
 *    contable/operativo cuando el cliente confirma por otro canal (WhatsApp,
 *    llamada, email fuera de sistema). Solo roles admin/admin_org/contador/operador.
 *
 * Ambas RPCs escriben bitácora; la del portal además dispara notificaciones
 * in-app a los operadores/admins/contadores de la organización.
 */
import { supabase } from "@/integrations/supabase/client";

export type RespuestaCliente = "aceptada" | "rechazada" | "pendiente";

interface RespuestaResult {
  id: string;
  estado_cliente: RespuestaCliente;
  respondida_at?: string;
  at?: string;
}


export async function actualizarEstadoClienteProforma(
  proformaId: string,
  respuesta: RespuestaCliente,
  motivo = "",
): Promise<RespuestaResult> {
  // SAFE-CAST: RPC firma via migración; tipos supabase-gen aún no la reflejan.
  const { data, error } = await (supabase.rpc as never as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: RespuestaResult | null; error: { message: string } | null }>)(
    "actualizar_estado_cliente_proforma",
    { p_proforma_id: proformaId, p_respuesta: respuesta, p_motivo: motivo },
  );
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Respuesta vacía del servidor");
  return data;
}
