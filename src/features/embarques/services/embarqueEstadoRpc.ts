/**
 * RPCs de cambio de estado de un embarque (avanzar / reabrir).
 *
 * Extraído de `mutations.ts` en v13.336.3 para respetar el límite Power-of-10
 * de 200 líneas por archivo. `mutations.ts` las re-exporta para mantener
 * compatibilidad con los imports existentes.
 */
import { supabase } from "@/integrations/supabase/client";
import { run } from "@/lib/supabase/response";
import { getErrorMessage } from "@/lib/errors";


export interface AvanzarEstadoEmbarqueInput {
  embarqueId: string;
  nuevoEstado: string;
  usuarioEmail: string;
  tipoEvento: string;
  descripcionEvento: string;
  requestId?: string;
}

export async function avanzarEstadoEmbarqueRpc(
  input: AvanzarEstadoEmbarqueInput,
): Promise<void> {
  await run(
    supabase.rpc("avanzar_estado_embarque", {
      p_embarque_id: input.embarqueId,
      p_nuevo_estado: input.nuevoEstado,
      p_usuario_email: input.usuarioEmail,
      p_tipo_evento: input.tipoEvento,
      p_descripcion_evento: input.descripcionEvento,
      p_request_id: input.requestId,
    }),
  );
}

export interface ReabrirEmbarqueInput {
  embarqueId: string;
  usuarioEmail: string;
  /** Obligatorio: mínimo 20 caracteres (validado también en la RPC). */
  motivo: string;
  requestId?: string;
}

/**
 * Reabre un embarque cerrado (estado Cerrado → Entregado). Solo admin/super_admin
 * pueden ejecutarla; el backend valida rol, motivo y estado actual.
 *
 * v13.337.0 — el error de Postgrest (objeto plano, NO `Error`) se traduce con
 * `getErrorMessage`; antes se hacía `String(e)`, que producía el inútil
 * "[object Object]" tanto en el toast como en Sentry.
 */
export async function reabrirEmbarqueRpc(input: ReabrirEmbarqueInput): Promise<void> {
  try {
    await run(
      supabase.rpc("reabrir_embarque", {
        p_embarque_id: input.embarqueId,
        p_usuario_email: input.usuarioEmail,
        p_motivo: input.motivo,
        p_request_id: input.requestId,
      }),
    );

  } catch (e) {
    const msg = getErrorMessage(e);
    if (/usa reabrir_embarque|bypass_cierre/i.test(msg)) {
      throw new Error(
        "El candado de embarque cerrado bloqueó la operación. Recarga la página e inténtalo de nuevo; si persiste, reporta el incidente.",
        { cause: e },
      );
    }
    throw e instanceof Error ? e : new Error(msg, { cause: e });
  }
}

