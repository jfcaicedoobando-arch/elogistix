import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token requerido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up the tracking link
    const { data: link, error: linkError } = await supabase
      .from("tracking_links")
      .select("*")
      .eq("token", token)
      .single();

    if (linkError || !link) {
      return new Response(
        JSON.stringify({ error: "Enlace de tracking no encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiration
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Este enlace de tracking ha expirado" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get embarque data
    const { data: embarque, error: embError } = await supabase
      .from("embarques")
      .select("id, expediente, cliente_nombre, modo, tipo, estado, etd, eta, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, tipo_servicio, tipo_carga, naviera, aerolinea, transportista")
      .eq("id", link.embarque_id)
      .single();

    if (embError || !embarque) {
      return new Response(
        JSON.stringify({ error: "Embarque no encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tracking events
    const { data: eventos = [] } = await supabase
      .from("eventos_embarque")
      .select("tipo, descripcion, ubicacion, fecha")
      .eq("embarque_id", link.embarque_id)
      .order("fecha", { ascending: false });

    // Get organization info for branding
    const { data: org } = await supabase
      .from("organizations")
      .select("nombre, logo_url")
      .eq("id", link.organization_id)
      .single();

    return new Response(
      JSON.stringify({
        embarque,
        eventos,
        organizacion: org ? { nombre: org.nombre, logo_url: org.logo_url } : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
