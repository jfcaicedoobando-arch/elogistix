// Edge function: crea un tracking request en Terminal49 para un embarque marítimo.
// Requiere usuario autenticado de la org dueña del embarque.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const T49_BASE = "https://api.terminal49.com/v2";
const T49_HEADERS_BASE: Record<string, string> = {
  "Content-Type": "application/vnd.api+json",
  Accept: "application/vnd.api+json",
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

async function logIntento(row: {
  embarque_id: string;
  organization_id: string;
  request_type?: string | null;
  request_number?: string | null;
  scac?: string | null;
  resultado: "exito" | "error" | "duplicado";
  http_status?: number | null;
  tracking_request_id?: string | null;
  mensaje?: string | null;
  detalle?: unknown;
  usuario_id?: string | null;
  usuario_email?: string | null;
}) {
  try {
    await supabaseAdmin.from("tracking_intentos").insert({
      embarque_id: row.embarque_id,
      organization_id: row.organization_id,
      provider: "terminal49",
      accion: "create",
      request_type: row.request_type ?? null,
      request_number: row.request_number ?? null,
      scac: row.scac ?? null,
      resultado: row.resultado,
      http_status: row.http_status ?? null,
      tracking_request_id: row.tracking_request_id ?? null,
      mensaje: row.mensaje ?? null,
      detalle: row.detalle ?? {},
      usuario_id: row.usuario_id ?? null,
      usuario_email: row.usuario_email ?? "",
    });
  } catch (e) {
    console.error("logIntento error", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let embarqueIdForLog: string | null = null;
  let orgIdForLog: string | null = null;
  let userIdForLog: string | null = null;
  let userEmailForLog = "";
  let requestTypeForLog: string | null = null;
  let requestNumberForLog: string | null = null;
  let scacForLog: string | null = null;

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
    userIdForLog = userData.user.id;
    userEmailForLog = userData.user.email ?? "";

    const body = await req.json().catch(() => null);
    const embarqueId = body?.embarque_id as string | undefined;
    const requestType = (body?.request_type as string | undefined) ?? "bill_of_lading";
    if (!embarqueId) return json({ error: "embarque_id requerido" }, 400);
    if (!["bill_of_lading", "booking_number", "container"].includes(requestType)) {
      return json({ error: "request_type inválido" }, 400);
    }
    embarqueIdForLog = embarqueId;
    requestTypeForLog = requestType;

    const { data: embarque, error: embErr } = await supabase
      .from("embarques")
      .select("id, organization_id, modo, bl_master, bl_house, contenedor, naviera, expediente")
      .eq("id", embarqueId)
      .maybeSingle();
    if (embErr || !embarque) return json({ error: "Embarque no encontrado" }, 404);
    orgIdForLog = embarque.organization_id;
    if (embarque.modo !== "Marítimo") {
      const msg = "Solo se admiten embarques marítimos";
      await logIntento({
        embarque_id: embarqueId, organization_id: embarque.organization_id,
        request_type: requestType, resultado: "error", mensaje: msg,
        usuario_id: userIdForLog, usuario_email: userEmailForLog,
      });
      return json({ error: msg }, 400);
    }

    const requestNumber =
      requestType === "bill_of_lading"
        ? embarque.bl_master
        : requestType === "booking_number"
        ? embarque.bl_master
        : embarque.contenedor;

    if (!requestNumber) {
      const msg = `El embarque no tiene ${requestType === "container" ? "contenedor" : "BL Master"}`;
      await logIntento({
        embarque_id: embarqueId, organization_id: embarque.organization_id,
        request_type: requestType, resultado: "error", mensaje: msg,
        usuario_id: userIdForLog, usuario_email: userEmailForLog,
      });
      return json({ error: msg }, 400);
    }
    requestNumberForLog = String(requestNumber).trim();

    // Resolver SCAC
    const navieraValor = (embarque.naviera ?? "").trim();
    let naviera: { code: string | null } | null = null;
    if (navieraValor) {
      const byCode = await supabase.from("navieras").select("code").ilike("code", navieraValor).maybeSingle();
      naviera = byCode.data ?? null;
      if (!naviera) {
        const byName = await supabase.from("navieras").select("code").ilike("name", navieraValor).maybeSingle();
        naviera = byName.data ?? null;
      }
    }
    const scac = (naviera?.code ?? navieraValor).toUpperCase();
    if (!/^[A-Z]{4}$/.test(scac)) {
      const msg = `No se encontró un SCAC válido de 4 letras para la naviera "${navieraValor}".`;
      await logIntento({
        embarque_id: embarqueId, organization_id: embarque.organization_id,
        request_type: requestType, request_number: requestNumberForLog,
        resultado: "error", mensaje: msg,
        usuario_id: userIdForLog, usuario_email: userEmailForLog,
      });
      return json({ error: msg + " Edita el embarque y selecciona una naviera del catálogo." }, 400);
    }
    scacForLog = scac;

    const t49Headers = { ...T49_HEADERS_BASE, Authorization: `Token ${apiKey}` };
    const t49Body = {
      data: {
        type: "tracking_request",
        attributes: {
          request_type: requestType,
          request_number: requestNumberForLog,
          scac,
          ref_numbers: [embarque.expediente].filter(Boolean),
        },
      },
    };

    let t49Res = await fetch(`${T49_BASE}/tracking_requests`, {
      method: "POST",
      headers: t49Headers,
      body: JSON.stringify(t49Body),
    });
    let t49Json: any = await t49Res.json().catch(() => ({}));
    let resultado: "exito" | "error" | "duplicado" = "exito";

    if (t49Res.status === 422) {
      const dupErr = Array.isArray(t49Json?.errors)
        ? t49Json.errors.find((e: any) => e?.code === "duplicate")
        : null;
      if (dupErr) {
        resultado = "duplicado";
        const existingId: string | undefined = dupErr?.meta?.tracking_request_id;
        if (existingId) {
          const getRes = await fetch(`${T49_BASE}/tracking_requests/${existingId}`, { headers: t49Headers });
          const getJson = await getRes.json().catch(() => ({}));
          if (getJson?.data) {
            t49Res = getRes;
            t49Json = { data: getJson.data };
          }
        }
        if (!t49Json?.data) {
          const listRes = await fetch(
            `${T49_BASE}/tracking_requests?filter[request_number]=${encodeURIComponent(requestNumberForLog)}`,
            { headers: t49Headers },
          );
          const listJson = await listRes.json().catch(() => ({}));
          const existing = Array.isArray(listJson?.data)
            ? listJson.data.find((r: any) => r?.attributes?.scac === scac)
            : null;
          if (existing) {
            t49Res = listRes;
            t49Json = { data: existing };
          }
        }
      }
    }

    if (!t49Res.ok && !t49Json?.data) {
      console.error("Terminal49 error", t49Res.status, t49Json);
      const msg = (Array.isArray(t49Json?.errors) && t49Json.errors[0]?.detail) || "Terminal49 rechazó el alta";
      await logIntento({
        embarque_id: embarqueId, organization_id: embarque.organization_id,
        request_type: requestType, request_number: requestNumberForLog, scac,
        resultado: "error", http_status: t49Res.status, mensaje: msg, detalle: t49Json,
        usuario_id: userIdForLog, usuario_email: userEmailForLog,
      });
      return json({ error: "Terminal49 rechazó el alta", status: t49Res.status, details: t49Json }, 502);
    }

    const tr = t49Json.data;
    const trackingRequestId: string | null = tr?.id ?? null;
    const status: string = tr?.attributes?.status ?? "pending";
    const failedReason: string | null = tr?.attributes?.failed_reason ?? null;

    const { data: upserted, error: upErr } = await supabaseAdmin
      .from("tracking_externo")
      .upsert(
        {
          embarque_id: embarqueId,
          organization_id: embarque.organization_id,
          provider: "terminal49",
          tracking_request_id: trackingRequestId,
          request_number: requestNumberForLog,
          request_type: requestType,
          scac,
          status,
          failed_reason: failedReason,
          last_synced_at: new Date().toISOString(),
          raw_payload: t49Json,
        },
        { onConflict: "embarque_id,provider" },
      )
      .select()
      .single();

    if (upErr) {
      console.error("Upsert error", upErr);
      await logIntento({
        embarque_id: embarqueId, organization_id: embarque.organization_id,
        request_type: requestType, request_number: requestNumberForLog, scac,
        tracking_request_id: trackingRequestId,
        resultado: "error", mensaje: "No se pudo guardar el tracking: " + upErr.message,
        usuario_id: userIdForLog, usuario_email: userEmailForLog,
      });
      return json({ error: "No se pudo guardar el tracking", details: upErr.message }, 500);
    }

    await logIntento({
      embarque_id: embarqueId, organization_id: embarque.organization_id,
      request_type: requestType, request_number: requestNumberForLog, scac,
      tracking_request_id: trackingRequestId,
      resultado, http_status: t49Res.status,
      mensaje: resultado === "duplicado"
        ? "Tracking ya existía en Terminal49 — vinculado al embarque"
        : `Tracking creado (estado: ${status})`,
      usuario_id: userIdForLog, usuario_email: userEmailForLog,
    });

    return json({ ok: true, tracking: upserted, terminal49: t49Json });
  } catch (err) {
    console.error("create-tracking exception", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (embarqueIdForLog && orgIdForLog) {
      await logIntento({
        embarque_id: embarqueIdForLog, organization_id: orgIdForLog,
        request_type: requestTypeForLog, request_number: requestNumberForLog, scac: scacForLog,
        resultado: "error", mensaje: "Excepción: " + msg,
        usuario_id: userIdForLog, usuario_email: userEmailForLog,
      });
    }
    return json({ error: msg }, 500);
  }
});
