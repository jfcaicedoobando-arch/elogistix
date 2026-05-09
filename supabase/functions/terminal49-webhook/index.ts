// Edge function pública: recibe webhooks de Terminal49 y actualiza tracking_externo + eventos.
// URL pública: https://eorqadkulqtneqjbsblk.supabase.co/functions/v1/terminal49-webhook
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-terminal49-signature",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function mapEventTypeToEnum(t49Event: string): string {
  const e = t49Event.toLowerCase();
  if (e.includes("vessel_loaded") || e.includes("vessel_departed")) return "Zarpe";
  if (e.includes("transshipment")) return "Transbordo";
  if (e.includes("vessel_arrived") || e.includes("arrived_at_port")) return "Arribo a Puerto";
  if (e.includes("discharged")) return "Descarga";
  if (e.includes("customs")) return "Despacho Aduanal";
  if (e.includes("released") || e.includes("available")) return "Liberación";
  if (e.includes("rail") || e.includes("inland")) return "En Ruta Terrestre";
  if (e.includes("full_out") || e.includes("delivered") || e.includes("empty_in")) return "Entrega";
  return "Otro";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ ok: true, message: "Terminal49 webhook endpoint activo" });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  let payload: any = null;
  try {
    const rawBody = await req.text();

    // Validación opcional de firma HMAC si TERMINAL49_WEBHOOK_SECRET está configurado
    const secret = Deno.env.get("TERMINAL49_WEBHOOK_SECRET");
    if (secret) {
      const signature = req.headers.get("x-terminal49-signature") ?? "";
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
      const expected = Array.from(new Uint8Array(sigBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      if (signature !== expected && signature !== `sha256=${expected}`) {
        console.warn("Firma inválida en webhook Terminal49");
        return json({ error: "Firma inválida" }, 401);
      }
    }

    payload = JSON.parse(rawBody);
  } catch (e) {
    return json({ error: "Body inválido" }, 400);
  }

  try {
    // Estructura típica Terminal49: { data: { type: "webhook_notification", attributes: { event, delivery_status }, relationships: { object: { data: { id, type } } } } }
    const data = payload?.data ?? payload;
    const eventType: string = data?.attributes?.event ?? payload?.event ?? "unknown";
    const objectId: string | null =
      data?.relationships?.object?.data?.id ?? data?.relationships?.tracking_request?.data?.id ?? null;
    const objectType: string =
      data?.relationships?.object?.data?.type ?? "unknown";

    console.log("Webhook Terminal49:", eventType, objectType, objectId);

    // Localizar tracking por tracking_request_id o shipment_id
    let trackingRow: any = null;
    if (objectId) {
      const byReq = await supabaseAdmin
        .from("tracking_externo")
        .select("*")
        .eq("provider", "terminal49")
        .eq("tracking_request_id", objectId)
        .maybeSingle();
      trackingRow = byReq.data;
      if (!trackingRow) {
        const byShip = await supabaseAdmin
          .from("tracking_externo")
          .select("*")
          .eq("provider", "terminal49")
          .eq("shipment_id", objectId)
          .maybeSingle();
        trackingRow = byShip.data;
      }
    }

    if (!trackingRow) {
      console.warn("Webhook recibido sin tracking asociado:", objectId);
      return json({ ok: true, ignored: true, reason: "tracking no encontrado" });
    }

    // Registrar intento/auditoría
    await supabaseAdmin.from("tracking_intentos").insert({
      embarque_id: trackingRow.embarque_id,
      organization_id: trackingRow.organization_id,
      provider: "terminal49",
      accion: "webhook",
      request_type: trackingRow.request_type,
      request_number: trackingRow.request_number,
      scac: trackingRow.scac,
      tracking_request_id: trackingRow.tracking_request_id,
      resultado: "exito",
      mensaje: `Webhook recibido: ${eventType}`,
      detalle: payload,
      usuario_email: "terminal49@webhook",
    });

    // Actualizar last_synced_at y raw_payload
    await supabaseAdmin
      .from("tracking_externo")
      .update({
        last_synced_at: new Date().toISOString(),
        raw_payload: payload,
      })
      .eq("id", trackingRow.id);

    // Si el evento trae timestamp/voyage info, registrar evento en línea de tiempo
    const evtAttrs = data?.attributes ?? {};
    const occurredAt = evtAttrs?.timestamp ?? evtAttrs?.occurred_at ?? evtAttrs?.created_at ?? null;
    if (eventType && eventType !== "unknown" && occurredAt) {
      await supabaseAdmin.from("eventos_embarque").insert({
        embarque_id: trackingRow.embarque_id,
        organization_id: trackingRow.organization_id,
        tipo: mapEventTypeToEnum(eventType),
        descripcion: `Terminal49: ${eventType}`,
        ubicacion: evtAttrs?.location_name ?? evtAttrs?.port_name ?? "",
        fecha: new Date(occurredAt).toISOString(),
        usuario: "terminal49@webhook",
      });
    }

    return json({ ok: true });
  } catch (err) {
    console.error("Webhook exception", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
