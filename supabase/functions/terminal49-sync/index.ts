// Edge function: re-sincroniza un tracking existente con Terminal49.
// Trae el tracking_request actualizado y, si ya hay shipment, su detalle con eventos.
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

// Mapeo de events de Terminal49 → enum tipo_evento_tracking
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

// Mapeo de estado de shipment → enum estado_embarque
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
    if (!embarqueId) return json({ error: "embarque_id requerido" }, 400);

    const { data: tracking, error: trErr } = await supabase
      .from("tracking_externo")
      .select("*")
      .eq("embarque_id", embarqueId)
      .eq("provider", "terminal49")
      .maybeSingle();
    if (trErr || !tracking) return json({ error: "No hay tracking activo" }, 404);

    const t49Headers = {
      Authorization: `Token ${apiKey}`,
      Accept: "application/vnd.api+json",
    };

    // 1. Refrescar el tracking_request
    let trackingRequestData: any = null;
    if (tracking.tracking_request_id) {
      const r = await fetch(
        `${T49_BASE}/tracking_requests/${tracking.tracking_request_id}?include=tracked_object`,
        { headers: t49Headers },
      );
      const j = await r.json().catch(() => ({}));
      if (r.ok) trackingRequestData = j;
    }

    const newStatus: string =
      trackingRequestData?.data?.attributes?.status ?? tracking.status;
    const newFailed: string | null =
      trackingRequestData?.data?.attributes?.failed_reason ?? null;
    let trackedObjectId: string | null =
      trackingRequestData?.data?.relationships?.tracked_object?.data?.id ?? tracking.shipment_id;

    // Fallback: si Terminal49 aún no asocia el tracked_object, buscamos el shipment por BL
    // probando varias variantes (con/sin prefijo SCAC, distintos nombres de filtro).
    const fallbackIntentos: Array<{ url: string; count: number }> = [];
    if (!trackedObjectId) {
      const blRaw: string =
        (tracking as any).request_number ||
        trackingRequestData?.data?.attributes?.request_number ||
        "";
      const scac: string = ((tracking as any).scac || trackingRequestData?.data?.attributes?.scac || "").toUpperCase();
      const blStripped =
        scac && blRaw.toUpperCase().startsWith(scac) ? blRaw.slice(scac.length) : blRaw;

      const candidatos: string[] = [];
      if (blRaw) candidatos.push(blRaw);
      if (blStripped && blStripped !== blRaw) candidatos.push(blStripped);

      const variantes: Array<(bl: string) => string> = [
        (bl) => `${T49_BASE}/shipments?filter[bill_of_lading_number]=${encodeURIComponent(bl)}`,
        (bl) => `${T49_BASE}/shipments?filter[number]=${encodeURIComponent(bl)}`,
      ];

      outer: for (const bl of candidatos) {
        for (const buildUrl of variantes) {
          const url = buildUrl(bl);
          const r = await fetch(url, { headers: t49Headers });
          const j = await r.json().catch(() => ({}));
          const arr = Array.isArray(j?.data) ? j.data : [];
          fallbackIntentos.push({ url, count: arr.length });
          console.log(`Fallback intento ${url} → ${arr.length} resultados`);
          if (arr[0]?.id) {
            trackedObjectId = arr[0].id;
            console.log(`Fallback OK → shipment ${trackedObjectId}`);
            break outer;
          }
        }
      }
    }

    let shipmentJson: any = null;
    let containers: any[] = [];
    let transportEvents: any[] = [];

    if (trackedObjectId) {
      const r = await fetch(
        `${T49_BASE}/shipments/${trackedObjectId}?include=containers,containers.transport_events,pod_terminal,destination_port`,
        { headers: t49Headers },
      );
      shipmentJson = await r.json().catch(() => ({}));
      if (Array.isArray(shipmentJson?.included)) {
        containers = shipmentJson.included.filter((i: any) => i.type === "container");
        transportEvents = shipmentJson.included.filter(
          (i: any) => i.type === "transport_event",
        );
      }
    }

    // Actualizar embarques.eta / fecha_llegada_real / estado si shipment expone fechas
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

    // Insertar transport_events nuevos en eventos_embarque (idempotente por descripción + fecha)
    let nuevosEventos = 0;
    if (transportEvents.length > 0) {
      const { data: orgRow } = await supabase
        .from("embarques")
        .select("organization_id")
        .eq("id", embarqueId)
        .maybeSingle();

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

    // Actualizar tracking_externo
    await supabase
      .from("tracking_externo")
      .update({
        shipment_id: trackedObjectId,
        status: newStatus,
        failed_reason: newFailed,
        last_synced_at: new Date().toISOString(),
        last_event_at: transportEvents[0]?.attributes?.timestamp ?? tracking.last_event_at,
        raw_payload: shipmentJson ?? trackingRequestData ?? tracking.raw_payload,
      })
      .eq("id", tracking.id);

    return json({
      ok: true,
      status: newStatus,
      containers: containers.length,
      eventos_nuevos: nuevosEventos,
      embarque_actualizado: embUpdate,
      fallback_bl_usado: fallbackUsed,
      shipment_id: trackedObjectId,
    });
  } catch (err) {
    console.error("sync exception", err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
