/**
 * AUDIT-17.1 — Notifica por email a operadores/admins de la organización
 * cuando un cliente responde una cotización desde el portal.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { authenticate } from "../_shared/auth.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
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
