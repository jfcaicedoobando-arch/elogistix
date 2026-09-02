/**
 * RPCs de cambio de estado de un embarque (avanzar / reabrir).
 *
 * Extraído de `mutations.ts` en v13.336.3 para respetar el límite Power-of-10
 * de 200 líneas por archivo. `mutations.ts` las re-exporta para mantener
 * compatibilidad con los imports existentes.
 */
import { supabase } from "@/integrations/supabase/client";
import { run, unwrap } from "@/lib/supabase/response";
import { getErrorMessage } from "@/lib/errors";
import { registrarBitacoraEmbarque } from "./bitacoraEmbarques";


export interface AvanzarEstadoEmbarqueInput {
  embarqueId: string;
  nuevoEstado: string;
  /**
   * @deprecated B-06 (v13.749.0): el actor de la bitácora se deriva en la BD
   * desde la sesión autenticada. Ya NO se envía a la RPC (era falsificable).
   * Se conserva en el input por compatibilidad con los hooks existentes.
   */
  usuarioEmail?: string;
  tipoEvento: string;
  descripcionEvento: string;
  requestId?: string;
}

/**
 * Resultado de la RPC de avance. `replay: true` = la respuesta venía del caché
 * de idempotencia (la transición NO se ejecutó esta vez); `pendiente: true` =
 * otro request con la misma llave la está ejecutando ahora mismo.
 */
export interface AvanzarEstadoResultado {
  replay: boolean;
  pendiente: boolean;
}

export async function avanzarEstadoEmbarqueRpc(
  input: AvanzarEstadoEmbarqueInput,
): Promise<AvanzarEstadoResultado> {
  const data: unknown = await unwrap(
    supabase.rpc("avanzar_estado_embarque", {
      p_embarque_id: input.embarqueId,
      p_nuevo_estado: input.nuevoEstado,
      // B-06: la RPC ignora este valor y usa auth.uid() -> auth.users.email.
      p_usuario_email: "",
      p_tipo_evento: input.tipoEvento,
      p_descripcion_evento: input.descripcionEvento,
      p_request_id: input.requestId,
    }),
  );
  const bag = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const replay = bag.replay === true;
  const pendiente = bag.__idempotency_pending === true;
  // FIX-R3 (delta_hunter P2): la bitácora "Avanzó estado" sólo se escribe
  // cuando la transición se ejecutó de verdad. Un replay cacheado (requestId
  // repetido, p. ej. re-disparo del auto-sync) o un claim en vuelo no movieron
  // el embarque en ESTA llamada — antes cada replay insertaba una fila más.
  if (!replay && !pendiente) {
    await registrarBitacoraEmbarque({
      accion: "Avanzó estado de embarque",
      entidadId: input.embarqueId,
      detalles: { nuevoEstado: input.nuevoEstado, tipoEvento: input.tipoEvento, descripcionEvento: input.descripcionEvento },
    });
  }
  return { replay, pendiente };
}

export interface ReabrirEmbarqueInput {
  embarqueId: string;
  /** @deprecated B-06: ignorado por la RPC (actor derivado de la sesión). */
  usuarioEmail?: string;
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
 *
 * v13.823.47 — devuelve `{ replay, pendiente }` con el MISMO contrato que
 * `avanzarEstadoEmbarqueRpc`. Antes la función era `void`, así que un claim de
 * idempotencia en vuelo (`__idempotency_pending`) se interpretaba como éxito:
 * el caller mostraba "Embarque reabierto" y quemaba la llave sin que la
 * reapertura hubiera ocurrido.
 */
export async function reabrirEmbarqueRpc(
  input: ReabrirEmbarqueInput,
): Promise<AvanzarEstadoResultado> {
  try {
    const data: unknown = await unwrap(
      supabase.rpc("reabrir_embarque", {
        p_embarque_id: input.embarqueId,
        // B-06: ignorado por la RPC; el actor real sale de la sesión.
        p_usuario_email: "",
        p_motivo: input.motivo,
        p_request_id: input.requestId,
      }),
    );
    const bag = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
    return { replay: bag.replay === true, pendiente: bag.__idempotency_pending === true };


  } catch (e) {
    const msg = getErrorMessage(e);
    // v13.356.0 — el guardia de transiciones bloqueaba Cerrado → Entregado y el
    // mensaje genérico del catálogo ("cambió en otra sesión") confundía al
    // usuario. Se inspecciona el mensaje CRUDO (antes de traducir el código LC)
    // para dar un texto específico de reapertura.
    const raw = e && typeof e === "object" && typeof (e as { message?: unknown }).message === "string"
      ? (e as { message: string }).message
      : "";
    if (/LC_TRANSICION_INVALIDA|Cerrado a Entregado/i.test(raw)) {
      throw new Error(
        "El validador de estados bloqueó la reapertura (Cerrado → Entregado). Recarga la página e inténtalo de nuevo; si persiste, reporta el incidente.",
        { cause: e },
      );
    }
    if (/usa reabrir_embarque|bypass_cierre/i.test(msg)) {
      throw new Error(
        "El candado de embarque cerrado bloqueó la operación. Recarga la página e inténtalo de nuevo; si persiste, reporta el incidente.",
        { cause: e },
      );
    }
    throw e instanceof Error ? e : new Error(msg, { cause: e });
  }
}

