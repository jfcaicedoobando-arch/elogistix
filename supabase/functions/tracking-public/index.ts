import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { handlePreflight } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return errorResponse("Token requerido", 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: link, error: linkError } = await supabase
      .from("tracking_links")
      .select("*")
      .eq("token", token)
      .single();

    if (linkError || !link) return errorResponse("Enlace de tracking no encontrado", 404);
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return errorResponse("Este enlace de tracking ha expirado", 410);
    }

    const { data: embarque, error: embError } = await supabase
      .from("embarques")
      .select("id, expediente, cliente_nombre, modo, tipo, estado, etd, eta, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, tipo_servicio, tipo_carga, naviera, aerolinea, transportista")
      .eq("id", link.embarque_id)
      .single();

    if (embError || !embarque) return errorResponse("Embarque no encontrado", 404);

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

    return jsonResponse({
      embarque,
      eventos,
      organizacion: org ? { nombre: org.nombre, logo_url: org.logo_url } : null,
    });
  } catch {
    return errorResponse("Error interno del servidor", 500);
  }
});
