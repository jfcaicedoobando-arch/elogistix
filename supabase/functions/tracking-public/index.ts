import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { handlePreflight } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { createLogger } from "../_shared/logger.ts";

type SupabaseClient = ReturnType<typeof createClient>;
type Logger = ReturnType<typeof createLogger>;

async function loadLink(supabase: SupabaseClient, token: string, log: Logger) {
  const { data: link, error } = await supabase
    .from("tracking_links")
    .select("*")
    .eq("token", token)
    .single();
  if (error || !link) {
    log.finish(404, "link_not_found", { payload: { token: token.slice(0, 8) } });
    return { error: errorResponse("Enlace de tracking no encontrado", 404) };
  }
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    log.finish(410, "link_expired", {
      organization_id: link.organization_id ?? null,
      payload: { embarque_id: link.embarque_id, expires_at: link.expires_at },
    });
    return { error: errorResponse("Este enlace de tracking ha expirado", 410) };
  }
  return { link };
}

async function loadEmbarqueData(
  supabase: SupabaseClient,
  link: { embarque_id: string; organization_id?: string | null },
  log: Logger,
) {
  const { data: embarque, error: embError } = await supabase
    .from("embarques")
    .select("id, expediente, cliente_nombre, modo, tipo, estado, etd, eta, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, tipo_servicio, tipo_carga, naviera, aerolinea, transportista")
    .eq("id", link.embarque_id)
    .single();
  if (embError || !embarque) {
    log.finish(404, "embarque_not_found", {
      organization_id: link.organization_id ?? null,
      payload: { embarque_id: link.embarque_id },
    });
    return { error: errorResponse("Embarque no encontrado", 404) };
  }
  const { data: eventos = [] } = await supabase
    .from("eventos_embarque")
    .select("tipo, descripcion, ubicacion, fecha")
    .eq("embarque_id", link.embarque_id)
    .order("fecha", { ascending: false });
  const { data: org } = await supabase
    .from("organizations")
    .select("nombre, logo_url")
    .eq("id", link.organization_id)
    .single();
  return { embarque, eventos: eventos ?? [], org };
}

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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const linkResult = await loadLink(supabase, token, log);
    if (linkResult.error) return linkResult.error;
    const link = linkResult.link!;

    const dataResult = await loadEmbarqueData(supabase, link, log);
    if (dataResult.error) return dataResult.error;
    const { embarque, eventos, org } = dataResult;

    log.finish(200, "tracking_served", {
      organization_id: link.organization_id ?? null,
      payload: { embarque_id: embarque!.id, eventos: eventos!.length },
    });
    return jsonResponse({
      embarque,
      eventos,
      organizacion: org ? { nombre: org.nombre, logo_url: org.logo_url } : null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.finish(500, "unhandled_error", { payload: { error: msg } });
    return errorResponse("Error interno del servidor", 500);
  }
});
