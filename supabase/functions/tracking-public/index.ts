import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { handlePreflight } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { createLogger } from "../_shared/logger.ts";

// Endpoint público: usa ANON_KEY + RPC SECURITY DEFINER (get_tracking_public).
// La RPC valida expiración y devuelve sólo los campos necesarios; no se expone
// SERVICE_ROLE_KEY al endpoint.
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
      return errorResponse("Error consultando tracking", 500);
    }

    const result = data as { error?: string; embarque?: unknown; eventos?: unknown; organizacion?: unknown } | null;
    if (!result || result.error === "not_found") {
      log.finish(404, "link_not_found", { payload: { token: token.slice(0, 8) } });
      return errorResponse("Enlace de tracking no encontrado", 404);
    }
    if (result.error === "expired") {
      log.finish(410, "link_expired");
      return errorResponse("Este enlace de tracking ha expirado", 410);
    }

    log.finish(200, "tracking_served");
    return jsonResponse({
      embarque: result.embarque,
      eventos: result.eventos ?? [],
      organizacion: result.organizacion ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.finish(500, "unhandled_error", { payload: { error: msg } });
    return errorResponse("Error interno del servidor", 500);
  }
});
