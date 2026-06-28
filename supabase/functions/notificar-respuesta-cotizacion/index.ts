/**
 * AUDIT-17.1 — Notifica por email a operadores/admins de la organización
 * cuando un cliente responde una cotización desde el portal.
 *
 * Flujo:
 *   1. Valida JWT del cliente del portal.
 *   2. Vía RPC SECURITY DEFINER `get_operadores_para_cotizacion`, resuelve los
 *      destinatarios server-side (el portal NUNCA elige a quién se le envía).
 *   3. Por cada destinatario, invoca `send-transactional-email` con el template
 *      `cotizacion-respuesta`. Idempotency-key por destinatario + estado.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { authenticate } from "../_shared/auth.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

interface ReqBody {
  cotizacion_id: string;
  estado: "Aceptada" | "Rechazada";
  comentario?: string;
}

function badRequest(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(
  wrapEdgeHandler("notificar-respuesta-cotizacion", async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return badRequest("Método no permitido", 405);

    let body: ReqBody;
    try {
      body = (await req.json()) as ReqBody;
    } catch {
      return badRequest("JSON inválido");
    }

    const cotizacionId = body?.cotizacion_id;
    const estado = body?.estado;
    const comentario = (body?.comentario ?? "").trim() || undefined;

    if (!cotizacionId || typeof cotizacionId !== "string") {
      return badRequest("cotizacion_id requerido");
    }
    if (estado !== "Aceptada" && estado !== "Rechazada") {
      return badRequest("estado inválido");
    }

    // 1) Autenticación del portal
    let ctx;
    try {
      ctx = await authenticate(req);
    } catch (e) {
      const msg = (e as Error).message ?? "";
      const status = msg.startsWith("401:") ? 401 : 500;
      return badRequest(msg.replace(/^\d+:/, ""), status);
    }

    // 2) Resolver destinatarios server-side (validación de ownership dentro del RPC)
    const { data: operadores, error: rpcErr } = await ctx.anonClient.rpc(
      "get_operadores_para_cotizacion",
      { p_cotizacion_id: cotizacionId },
    );

    if (rpcErr) {
      console.error("get_operadores_para_cotizacion failed", rpcErr);
      return badRequest("No se pudieron resolver destinatarios", 500);
    }

    const recipients = (operadores ?? []) as Array<{ user_id: string; email: string }>;
    if (recipients.length === 0) {
      // Sin operadores configurados o sin acceso → no es error duro.
      return new Response(JSON.stringify({ sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Cargar datos de la cotización para templateData (vía admin para asegurar lectura)
    const { data: cot, error: cotErr } = await ctx.adminClient
      .from("cotizaciones")
      .select("folio,cliente_nombre,organization_id")
      .eq("id", cotizacionId)
      .maybeSingle();

    if (cotErr || !cot) {
      console.error("cotizacion fetch failed", cotErr);
      return badRequest("Cotización no encontrada", 404);
    }

    // 4) Enviar a cada destinatario
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminInvoker = createClient(supabaseUrl, serviceKey);

    const baseUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://librecarga.com";
    const enlace = `${baseUrl.replace(/\/+$/, "")}/cotizaciones/${cotizacionId}`;

    let sent = 0;
    const failures: Array<{ email: string; error: string }> = [];

    for (const r of recipients) {
      const idempotencyKey = `cotizacion-respuesta-${cotizacionId}-${estado}-${r.user_id}`;
      const messageId = crypto.randomUUID();
      const { error: invokeErr } = await adminInvoker.functions.invoke(
        "send-transactional-email",
        {
          body: {
            templateName: "cotizacion-respuesta",
            recipientEmail: r.email,
            messageId,
            idempotencyKey,
            templateData: {
              folio: cot.folio ?? "",
              cliente: cot.cliente_nombre ?? "",
              estado,
              comentario,
              enlace,
            },
          },
        },
      );
      if (invokeErr) {
        failures.push({ email: r.email, error: invokeErr.message });
      } else {
        sent += 1;
      }
    }

    return new Response(JSON.stringify({ sent, failures }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }),
);
