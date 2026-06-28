/**
 * Helpers puros de `notificar-respuesta-cotizacion`. Extraídos para mantener
 * la complejidad ciclomática del handler ≤ 16 (ESLint).
 */
import { corsHeaders } from "../_shared/cors.ts";

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

export interface EmailInvoker {
  invoke(
    name: string,
    options: { body: unknown },
  ): Promise<{ error: { message: string } | null }>;
}

export interface SendArgs {
  invoker: EmailInvoker;
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
    const { error } = await args.invoker.invoke("send-transactional-email", {
      body: {
        templateName: "cotizacion-respuesta",
        recipientEmail: r.email,
        messageId: crypto.randomUUID(),
        idempotencyKey,
        templateData: {
          folio: args.folio,
          cliente: args.cliente,
          estado: args.estado,
          comentario: args.comentario,
          enlace: args.enlace,
        },
      },
    });
    if (error) failures.push({ email: r.email, error: error.message });
    else sent += 1;
  }
  return { sent, failures };
}
