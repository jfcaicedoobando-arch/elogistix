/**
 * R3 · P2 — Escritura idempotente de estados en `email_send_log`.
 *
 * El índice único total `uq_email_send_log_message_id` (migración
 * 20260819230053) hace que un segundo `.insert()` con el mismo message_id
 * reviente con 23505. Varios flujos lo hacían y tragaban el error:
 *
 *  - `send-transactional-email`: 'pending' y luego otro insert 'failed' si el
 *    enqueue fallaba → la fila quedaba zombie en 'pending' y el fallo se
 *    perdía en silencio.
 *  - `process-email-queue`: 'sent'/'failed'/'rate_limited'/'dlq' con insert
 *    tras el 'pending' → nunca se marcaban; el dedupe `isAlreadySent` no
 *    encontraba la fila 'sent' y se podía reenviar correo.
 *
 * Esta helper delega en la RPC `email_send_log_touch` (upsert por message_id,
 * incrementa `intentos` en fallos) y NUNCA lanza: el logging no debe romper
 * el flujo de correo. Devuelve `false` si el registro falló (para que el
 * caller decida; p. ej. auth-email-hook lo trata como reintentable).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type EstadoEmailLog =
  | "pending"
  | "sent"
  | "failed"
  | "rate_limited"
  | "dlq"
  | "suppressed";

export interface EntradaEmailLog {
  messageId: unknown;
  templateName: unknown;
  recipientEmail: unknown;
  status: EstadoEmailLog;
  errorMessage?: string | null;
}

export async function registrarEstadoEmail(
  supabase: SupabaseClient,
  entrada: EntradaEmailLog,
): Promise<boolean> {
  if (typeof entrada.messageId !== "string" || !entrada.messageId) return false;
  const { error } = await supabase.rpc("email_send_log_touch", {
    p_message_id: entrada.messageId,
    p_template: String(entrada.templateName ?? "desconocido"),
    p_recipient: typeof entrada.recipientEmail === "string" ? entrada.recipientEmail : "",
    p_status: entrada.status,
    p_error: entrada.errorMessage ?? null,
  });
  if (error) {
    // Sin PII en el log: sólo message_id y estado.
    console.error("email_send_log_touch failed", {
      message_id: entrada.messageId,
      status: entrada.status,
      error: error.message,
    });
    return false;
  }
  return true;
}
