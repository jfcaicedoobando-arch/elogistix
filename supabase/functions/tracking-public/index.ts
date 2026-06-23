import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { handlePreflight } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { createLogger } from "../_shared/logger.ts";
import { initSentryEdge, captureEdgeException } from "../_shared/sentry.ts";

initSentryEdge("tracking-public");

type TrackingRpcResult = {
  error?: string;
  embarque?: unknown;
  eventos?: unknown;
  organizacion?: unknown;
} | null;

export type TrackingOutcome =
  | { ok: true; embarque: unknown; eventos: unknown; organizacion: unknown }
  | { ok: false; status: 400 | 404 | 410; error: string };

/** Pure helper: maps the RPC result to a typed outcome (no network). */
export function classifyTrackingResult(
  token: string | null,
  result: TrackingRpcResult,
): TrackingOutcome {
  if (!token) return { ok: false, status: 400, error: "Token requerido" };
  const r = result;
  if (!r || r.error === "not_found") {
    return { ok: false, status: 404, error: "Enlace de tracking no encontrado" };
  }
  if (r.error === "expired") {
    return { ok: false, status: 410, error: "Este enlace de tracking ha expirado" };
  }
  return {
    ok: true,
    embarque: r.embarque,
    eventos: r.eventos ?? [],
    organizacion: r.organizacion ?? null,
  };
}

// Endpoint público: usa ANON_KEY + RPC SECURITY DEFINER (get_tracking_public).
Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const log = createLogger(req, "tracking-public");

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) {
      log.finish(400, "missing_token");
      return errorResponse("Token requerido", 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabase.rpc("get_tracking_public", { p_token: token });
    if (error) {
      log.finish(500, "rpc_error", { payload: { error: error.message } });
      // 13.114.20: el `errorResponse` corta el flujo antes del catch global —
      // capturamos explícitamente para no perder fallos de la RPC pública.
      await captureEdgeException(error, {
        fn: "tracking-public",
        status_code: 500,
        extra: { phase: "rpc_get_tracking_public" },
      });
      return errorResponse("Error consultando tracking", 500);
    }

    const outcome = classifyTrackingResult(token, data as TrackingRpcResult);
    if (!outcome.ok) {
      log.finish(outcome.status, "tracking_classified");
      return errorResponse(outcome.error, outcome.status);
    }

    log.finish(200, "tracking_served");
    return jsonResponse({
      embarque: outcome.embarque,
      eventos: outcome.eventos,
      organizacion: outcome.organizacion,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.finish(500, "unhandled_error", { payload: { error: msg } });
    await captureEdgeException(err, { fn: "tracking-public", status_code: 500 });
    return errorResponse("Error interno del servidor", 500);
  }
});
