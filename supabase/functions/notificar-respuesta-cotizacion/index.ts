/**
 * AUDIT-17.1 — Notifica por email a operadores/admins de la organización
 * cuando un cliente responde una cotización desde el portal.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { authenticate, type AuthContext } from "../_shared/auth.ts";
import { wrapEdgeHandler, captureEdgeException } from "../_shared/sentry.ts";
import {
  badRequest,
  jsonResponse,
  parseInput,
  sendToRecipients,
  type Recipient,
} from "./helpers.ts";

declare const Deno: { env: { get(key: string): string | undefined } };

async function readBody(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function authOrError(req: Request) {
  try {
    return { ctx: await authenticate(req) };
  } catch (e) {
    const msg = (e as Error).message ?? "";
    const status = msg.startsWith("401:") ? 401 : 500;
    return { error: badRequest(msg.replace(/^\d+:/, ""), status) };
  }
}

/** R3 · P3 — dedupe por (cotización, estado) + tope por usuario portal. */
async function checkThrottle(
  ctx: AuthContext,
  cotizacionId: string,
  estado: string,
): Promise<Response | null> {
  const reglas = [
    { key: `cotizacion-respuesta:${cotizacionId}:${estado}`, windowSeconds: 600, max: 1, duplicada: true },
    { key: `cotizacion-respuesta:user:${ctx.userId}`, windowSeconds: 3600, max: 30, duplicada: false },
  ];
  for (const regla of reglas) {
    const { data, error } = await ctx.adminClient.rpc("check_ratelimit", {
      p_key: regla.key,
      p_window_seconds: regla.windowSeconds,
      p_max: regla.max,
    });
    if (error) {
      await captureEdgeException(new Error(`check_ratelimit failed: ${error.message}`), {
        fn: "notificar-respuesta-cotizacion",
      });
      continue; // fail-open: la notificación legítima no se pierde
    }
    const res = data as { ok?: boolean } | null;
    if (res?.ok === false) {
      return regla.duplicada
        // Misma respuesta ya notificada hace <10 min: idempotente, no es error.
        ? jsonResponse({ sent: 0, deduplicated: true })
        : jsonResponse({ error: "Demasiadas notificaciones; intenta más tarde" }, 429);
    }
  }
  return null;
}

Deno.serve(
  wrapEdgeHandler("notificar-respuesta-cotizacion", async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return badRequest("Método no permitido", 405);

    const raw = await readBody(req);
    if (raw === null) return badRequest("JSON inválido");

    const parsed = parseInput(raw);
    if ("error" in parsed) return badRequest(parsed.error);

    const auth = await authOrError(req);
    if (auth.error) return auth.error;
    const ctx = auth.ctx!;

    // R3 · P3: freno de frecuencia. Un usuario portal podía invocar en bucle
    // con el mismo cotizacion_id y cada llamada reenviaba correos a TODOS los
    // operadores de la org. Dedupe por (cotización, estado) 10 min + tope por
    // usuario. Fail-open con captura a Sentry: si la RPC falta, la notificación
    // legítima no debe perderse.
    const throttle = await checkThrottle(ctx, parsed.cotizacionId, parsed.estado);
    if (throttle) return throttle;

    const { data: operadores, error: rpcErr } = await ctx.anonClient.rpc(
      "get_operadores_para_cotizacion",
      { p_cotizacion_id: parsed.cotizacionId },
    );
    if (rpcErr) {
      console.error("get_operadores_para_cotizacion failed", rpcErr);
      return badRequest("No se pudieron resolver destinatarios", 500);
    }

    const recipients = (operadores ?? []) as Recipient[];
    if (recipients.length === 0) return jsonResponse({ sent: 0 });

    const { data: cot, error: cotErr } = await ctx.adminClient
      .from("cotizaciones")
      .select("folio,cliente_nombre,organization_id")
      .eq("id", parsed.cotizacionId)
      .maybeSingle();
    if (cotErr || !cot) {
      console.error("cotizacion fetch failed", cotErr);
      return badRequest("Cotización no encontrada", 404);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const invoker = createClient(supabaseUrl, serviceKey);
    const baseUrl = Deno.env.get("PUBLIC_SITE_URL") ?? "https://librecarga.com";
    const enlace = `${baseUrl.replace(/\/+$/, "")}/cotizaciones/${parsed.cotizacionId}`;

    const result = await sendToRecipients({
      invoker,
      recipients,
      cotizacionId: parsed.cotizacionId,
      estado: parsed.estado,
      comentario: parsed.comentario,
      folio: cot.folio ?? "",
      cliente: cot.cliente_nombre ?? "",
      enlace,
    });

    return jsonResponse(result);
  }),
);
