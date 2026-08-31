/**
 * Helpers puros de `notificar-respuesta-cotizacion`. Extraídos para mantener
 * la complejidad ciclomática del handler ≤ 16 (ESLint).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { enviarEmailPlantilla } from "../_shared/enviarEmailPlantilla.ts";

export interface ReqBody {
  cotizacion_id: string;
  estado: "Aceptada" | "Rechazada";
  comentario?: string;
}

export interface ParsedInput {
  cotizacionId: string;
  estado: "Aceptada" | "Rechazada";
  comentario?: string;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function badRequest(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

export function parseInput(body: unknown): ParsedInput | { error: string } {
  const b = (body ?? {}) as Partial<ReqBody>;
  const cotizacionId = b.cotizacion_id;
  const estado = b.estado;
  const comentario = (b.comentario ?? "").trim() || undefined;
  if (!cotizacionId || typeof cotizacionId !== "string") {
    return { error: "cotizacion_id requerido" };
  }
  if (estado !== "Aceptada" && estado !== "Rechazada") {
    return { error: "estado inválido" };
  }
  return { cotizacionId, estado, comentario };
}

export interface Recipient {
  user_id: string;
  email: string;
}



export interface SendArgs {
  invoker: SupabaseClient;
  recipients: Recipient[];
  cotizacionId: string;
  estado: "Aceptada" | "Rechazada";
  comentario: string | undefined;
  folio: string;
  cliente: string;
  enlace: string;
}

export async function sendToRecipients(args: SendArgs) {
  let sent = 0;
  const failures: Array<{ email: string; error: string }> = [];
  for (const r of args.recipients) {
    const idempotencyKey = `cotizacion-respuesta-${args.cotizacionId}-${args.estado}-${r.user_id}`;
    const envio = await enviarEmailPlantilla(args.invoker, {
      templateName: "cotizacion-respuesta",
      recipientEmail: r.email,
      idempotencyKey,
      templateData: {
        folio: args.folio,
        cliente: args.cliente,
        estado: args.estado,
        comentario: args.comentario,
        enlace: args.enlace,
      },
    });
    if (!envio.ok) failures.push({ email: r.email, error: envio.error ?? "Error al enviar correo" });
    else sent += 1;
  }
  return { sent, failures };
}
