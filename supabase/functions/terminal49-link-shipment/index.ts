// Edge function: vincula manualmente un shipment de Terminal49 al embarque
// cuando el flujo automático no logra resolver el tracked_object.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const T49_BASE = "https://api.terminal49.com/v2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function mapEventTypeToEnum(t49Event: string): string {
  if (t49Event.includes("vessel_loaded") || t49Event.includes("vessel_departed")) return "Zarpe";
  if (t49Event.includes("transshipment")) return "Transbordo";
  if (t49Event.includes("vessel_arrived") || t49Event.includes("arrived_at_port"))
    return "Arribo a Puerto";
  if (t49Event.includes("discharged")) return "Descarga";
  if (t49Event.includes("customs")) return "Despacho Aduanal";
  if (t49Event.includes("released") || t49Event.includes("available")) return "Liberación";
  if (t49Event.includes("rail") || t49Event.includes("inland")) return "En Ruta Terrestre";
  if (t49Event.includes("full_out") || t49Event.includes("delivered") || t49Event.includes("empty_in"))
    return "Entrega";
  return "Otro";
}

function mapStatusToEstado(currentStatus: string): string | null {
  const s = currentStatus.toLowerCase();
  if (s.includes("scheduled") || s.includes("planned")) return "Confirmado";
  if (s.includes("in_transit") || s.includes("vessel_departed")) return "En Tránsito";
  if (s.includes("vessel_arrived") || s.includes("arrived")) return "Arribo";
  if (s.includes("discharged") || s.includes("at_terminal")) return "En Aduana";
  if (s.includes("delivered") || s.includes("full_out")) return "Entregado";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("TERMINAL49_API_KEY");
    if (!apiKey) return json({ error: "TERMINAL49_API_KEY no configurada" }, 500);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "No autenticado" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return json({ error: "Token inválido" }, 401);

    const body = await req.json().catch(() => null);
    const embarqueId = body?.embarque_id as string | undefined;
    const shipmentIdRaw = (body?.shipment_id as string | undefined)?.trim();
    if (!embarqueId) return json({ error: "embarque_id requerido" }, 400);
    if (!shipmentIdRaw) return json({ error: "shipment_id requerido" }, 400);

    // Validación básica de formato UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(shipmentIdRaw)) {
      return json({ error: "El shipment ID debe ser un UUID válido (cópialo de la URL de Terminal49)" }, 400);
    }
    const shipmentId = shipmentIdRaw.toLowerCase();

    const { data: tracking, error: trErr } = await supabase
      .from("tracking_externo")
      .select("*")
      .eq("embarque_id", embarqueId)
      .eq("provider", "terminal49")
      .maybeSingle();
    if (trErr || !tracking) return json({ error: "No hay tracking activo para este embarque" }, 404);

    const t49Headers = {
      Authorization: `Token ${apiKey}`,
      Accept: "application/vnd.api+json",
    };

    // Confirmar que el shipment existe y traer detalles + eventos
    const r = await fetch(
      `${T49_BASE}/shipments/${shipmentId}?include=containers,containers.transport_events,pod_terminal,destination_port`,
      { headers: t49Headers },
    );
    const shipmentJson: any = await r.json().catch(() => ({}));
    if (!r.ok || !shipmentJson?.data?.id) {
      const detail = shipmentJson?.errors?.[0]?.detail ?? `HTTP ${r.status}`;
      return json({ error: `Terminal49 no encontró el shipment: ${detail}`, status: r.status }, 404);
    }

    const containers = Array.isArray(shipmentJson?.included)
      ? shipmentJson.included.filter((i: any) => i.type === "container")
      : [];
    const transportEvents = Array.isArray(shipmentJson?.included)
      ? shipmentJson.included.filter((i: any) => i.type === "transport_event")
      : [];

    // Actualizar embarque con ETA / fecha llegada / estado
    const shipmentAttrs = shipmentJson?.data?.attributes ?? {};
    const newEta: string | null =
      shipmentAttrs?.pod_eta_at ?? shipmentAttrs?.destination_eta_at ?? null;
    const arrivedAt: string | null = shipmentAttrs?.pod_arrived_at ?? null;
    const shipmentStatus: string =
      shipmentAttrs?.normalized_state ?? shipmentAttrs?.current_state ?? "";
    const mappedEstado = shipmentStatus ? mapStatusToEstado(shipmentStatus) : null;

    const embUpdate: Record<string, unknown> = {};
    if (newEta) embUpdate.eta = newEta.slice(0, 10);
    if (arrivedAt) embUpdate.fecha_llegada_real = arrivedAt.slice(0, 10);
    if (mappedEstado) embUpdate.estado = mappedEstado;
    if (Object.keys(embUpdate).length > 0) {
      await supabase.from("embarques").update(embUpdate).eq("id", embarqueId);
    }

    // Insertar transport events nuevos
    let nuevosEventos = 0;
    const { data: orgRow } = await supabase
      .from("embarques")
      .select("organization_id")
      .eq("id", embarqueId)
      .maybeSingle();

    if (transportEvents.length > 0) {
      const { data: existentes } = await supabase
        .from("eventos_embarque")
        .select("descripcion, fecha")
        .eq("embarque_id", embarqueId);
      const yaExiste = new Set(
        (existentes ?? []).map(
          (e: any) => `${e.descripcion}::${new Date(e.fecha).toISOString().slice(0, 16)}`,
        ),
      );
      const inserts: any[] = [];
      for (const ev of transportEvents) {
        const attrs = ev.attributes ?? {};
        const evType = attrs.event ?? attrs.event_type ?? "Otro";
        const descripcion = `[Terminal49] ${evType.replace(/_/g, " ")}`;
        const fechaIso = attrs.timestamp ?? attrs.event_at ?? null;
        if (!fechaIso) continue;
        const key = `${descripcion}::${new Date(fechaIso).toISOString().slice(0, 16)}`;
        if (yaExiste.has(key)) continue;
        inserts.push({
          embarque_id: embarqueId,
          organization_id: orgRow?.organization_id,
          tipo: mapEventTypeToEnum(evType),
          descripcion,
          ubicacion: attrs.location_locode ?? attrs.location_name ?? "",
          fecha: fechaIso,
          usuario: "Terminal49",
        });
      }
      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from("eventos_embarque").insert(inserts);
        if (!insErr) nuevosEventos = inserts.length;
        else console.error("Insert eventos error", insErr);
      }
    }

    const newStatus =
      shipmentAttrs?.normalized_state ??
      shipmentAttrs?.current_state ??
      tracking.status ??
      "linked";

    // Actualizar tracking_externo con el shipment vinculado
    await supabase
      .from("tracking_externo")
      .update({
        shipment_id: shipmentId,
        status: newStatus,
        failed_reason: null,
        last_synced_at: new Date().toISOString(),
        last_event_at: transportEvents[0]?.attributes?.timestamp ?? tracking.last_event_at,
        raw_payload: shipmentJson,
      })
      .eq("id", tracking.id);

    // Registrar intento manual
    await supabase.from("tracking_intentos").insert({
      embarque_id: embarqueId,
      organization_id: orgRow?.organization_id,
      provider: "terminal49",
      accion: "link_manual",
      request_type: tracking.request_type,
      request_number: tracking.request_number,
      scac: tracking.scac,
      resultado: "exito",
      http_status: 200,
      tracking_request_id: tracking.tracking_request_id,
      mensaje: `Shipment vinculado manualmente: ${shipmentId}`,
      detalle: { shipment_id: shipmentId, eventos_nuevos: nuevosEventos, containers: containers.length },
      usuario_id: userData.user.id,
      usuario_email: userData.user.email ?? "",
    });

    return json({
      ok: true,
      shipment_id: shipmentId,
      status: newStatus,
      containers: containers.length,
      eventos_nuevos: nuevosEventos,
      embarque_actualizado: embUpdate,
    });
  } catch (err) {
    console.error("link-shipment exception", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
