import type { SupabaseClient } from "npm:@supabase/supabase-js@2.119.0";
import { captureEdgeException } from "../_shared/sentry.ts";
import { despacharEvento, type ResultadoWebhook } from "./despachar.ts";
import type { FacturapiWebhookEvent } from "./helpers.ts";

type EstadoTerminal = "legado" | "procesado" | "ignorado" | "agotado";

type Reserva =
  | { estado: "tomado"; id: string; token: string; payload: FacturapiWebhookEvent }
  | { estado: "terminado"; resultado: EstadoTerminal }
  | { estado: "ausente" | "ocupado" };

type ResultadoPersistido =
  | { estado: "procesado"; tabla: "facturas" | "pagos_factura" }
  | { estado: "ignorado" | "reintentable"; motivo: string | null }
  | { estado: "reserva_perdida" };

type ResultadoProcesamiento = Exclude<Reserva, { estado: "tomado" }> | ResultadoPersistido;

async function finalizar(
  supabase: SupabaseClient, reserva: Extract<Reserva, { estado: "tomado" }>, resultado: ResultadoWebhook | null,
): Promise<ResultadoPersistido> {
  const datos = resultado?.estado === "aplicar"
    ? {
      p_resultado: "aplicar", p_tabla: resultado.tabla, p_documento_id: resultado.id,
      p_version: resultado.version, p_claim: resultado.claim, p_patch: resultado.patch, p_accion: resultado.accion,
    }
    : {
      p_resultado: resultado?.estado === "ignorar" ? "ignorado" : "reintentable",
      p_motivo: resultado?.motivo ?? "procesamiento_fallido",
    };
  const { data, error } = await supabase.rpc("finalizar_evento_facturapi_webhook", {
    p_evento_id: reserva.id, p_token: reserva.token, ...datos,
  });
  if (error) throw error;
  // SAFE-CAST: estado y motivo emitidos por la RPC de finalización.
  return data as ResultadoPersistido;
}

export async function procesarEventoWebhook(
  supabase: SupabaseClient, orgId: string, eventId: string, payload?: FacturapiWebhookEvent,
): Promise<ResultadoProcesamiento> {
  const { data, error } = await supabase.rpc("reservar_evento_facturapi_webhook", {
    p_organization_id: orgId, p_event_id: eventId, p_payload: payload ?? null,
  });
  if (error) throw error;
  // SAFE-CAST: contrato de la RPC; el payload fue validado al recibir el HMAC.
  const reserva = data as Reserva;
  if (reserva.estado !== "tomado") return reserva;

  try {
    const resultado = await despacharEvento(supabase, orgId, reserva.payload);
    return await finalizar(supabase, reserva, resultado);
  } catch (error) {
    await captureEdgeException(error, {
      fn: "facturapi-webhook", organization_id: orgId,
      extra: { event_id: eventId, event_type: reserva.payload.type },
    });
    return finalizar(supabase, reserva, null);
  }
}
