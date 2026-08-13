/**
 * Guardas de entrada y carga del lote pendiente del cron
 * `facturapi-reconciliar-cancelaciones`. Separado de `index.ts` para mantener
 * los archivos bajo el límite de líneas (Power of 10).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { captureEdgeMessage } from "../_shared/sentry.ts";
import { jsonResponse } from "../_shared/response.ts";
import type { FacturaPendiente, NotaCreditoPendiente, RepPendiente } from "./reconcile.ts";

const LOTE_MAX = 200;

export type Pendientes = {
  facturas: FacturaPendiente[];
  notasCredito: NotaCreditoPendiente[];
  reps: RepPendiente[];
};

/** Guard de método + secreto cron. Devuelve Response para cortar, o null para seguir. */
export function validarRequest(req: Request, cronSecret: string | undefined): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }
  // M8: endpoint cron-only — mismo patrón que rep-retry-nocturno.
  if (!cronSecret || req.headers.get("X-Cron-Secret") !== cronSecret) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }
  return null;
}

/**
 * Lee facturas y notas de crédito con cancelación `pending`/`verifying`.
 * EF-03: las NC también se reconcilian aquí — el webhook no las resuelve
 * (factura_not_found → ignored) y sin este barrido quedaban 'pending' para
 * siempre tras el silencio positivo de 72 h.
 * REF-02: mismo tratamiento para los REP (pagos_factura.rep_cancellation_status),
 * cuya única vía de cierre era el webhook.
 */
export async function cargarPendientes(
  supabase: SupabaseClient,
): Promise<{ ok: true; data: Pendientes } | { ok: false; res: Response }> {
  const { data: pendientes, error: fetchErr } = await supabase
    .from("facturas")
    .select("id, organization_id, facturapi_id, cancellation_status, sustituida_por")
    .in("cancellation_status", ["pending", "verifying"])
    .not("facturapi_id", "is", null)
    .limit(LOTE_MAX);
  if (fetchErr) {
    return { ok: false, res: jsonResponse({ error: "db_fetch_failed", detail: fetchErr.message }, 500) };
  }

  // EF-12: si el lote llega al tope de 200 probablemente hay backlog que tarda
  // horas en drenar a 200/30 min — dejar señal en Sentry para operación.
  if ((pendientes ?? []).length === LOTE_MAX) {
    await captureEdgeMessage("facturapi_reconciliar_backlog", "warning", {
      fn: "facturapi-reconciliar-cancelaciones",
      extra: { pendientes: LOTE_MAX },
    });
  }

  const { data: ncPendientes, error: ncFetchErr } = await supabase
    .from("factura_notas_credito")
    .select("id, organization_id, facturapi_id, cancellation_status")
    .in("cancellation_status", ["pending", "verifying"])
    .not("facturapi_id", "is", null)
    .limit(LOTE_MAX);
  if (ncFetchErr) {
    return { ok: false, res: jsonResponse({ error: "db_fetch_failed", detail: ncFetchErr.message }, 500) };
  }

  // REF-02 (espejo EF-03 para REP): se excluyen los claims PENDING:<uuid> de
  // EF-01 (REP aún no timbrado; los resuelve facturapi-recuperar-claim).
  const { data: repPendientes, error: repFetchErr } = await supabase
    .from("pagos_factura")
    .select("id, organization_id, facturapi_rep_id, rep_cancellation_status")
    .in("rep_cancellation_status", ["pending", "verifying"])
    .not("facturapi_rep_id", "is", null)
    .not("facturapi_rep_id", "like", "PENDING:%")
    .limit(LOTE_MAX);
  if (repFetchErr) {
    return { ok: false, res: jsonResponse({ error: "db_fetch_failed", detail: repFetchErr.message }, 500) };
  }

  return {
    ok: true,
    data: {
      facturas: (pendientes ?? []) as FacturaPendiente[],
      notasCredito: (ncPendientes ?? []) as NotaCreditoPendiente[],
      reps: (repPendientes ?? []) as RepPendiente[],
    },
  };
}
