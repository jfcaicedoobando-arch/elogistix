/**
 * REF-03: registro idempotente en `email_send_log` para el hook de correos de
 * auth. El hook de Supabase Auth reintenta con el mismo `run_id`, así que el
 * `message_id` es determinista (`auth-<run_id>`) y el insert es un upsert con
 * `ignoreDuplicates` sobre el índice único `uq_email_send_log_message_id`.
 *
 * - Si la fila ya existía y NO está en `failed`, el intento original ya encoló
 *   (o envió) el correo → hay que deduplicar y NO re-encolar.
 * - Si estaba en `failed`, el intento anterior murió antes de encolar → es un
 *   reintento legítimo: la misma fila vuelve a `pending`.
 * - R3EF-03(a): si el upsert del log falla, devuelve `logError: true` y el
 *   caller responde 500 SIN encolar (fail-closed: encolar sin log impediría
 *   deduplicar el reintento y dejaría fallos invisibles).
 * - R3EF-03(b): una fila `pending` con más de PENDING_STALE_MS se interpreta
 *   como crash entre el upsert y el enqueue → se reintenta sobre la misma fila
 *   en vez de deduplicar para siempre.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

/** Antigüedad máxima de una fila `pending` sana (cola + enqueue son de segundos). */
const PENDING_STALE_MS = 10 * 60 * 1000

export interface ResultadoDedupe {
  deduplicated: boolean
  /** true = el upsert del log falló; el caller NO debe encolar (fail-closed). */
  logError: boolean
}

export async function registrarPendiente(
  supabase: SupabaseClient,
  params: { messageId: string; emailType: string; recipient: string; runId: string },
): Promise<ResultadoDedupe> {
  const { messageId, emailType, recipient, runId } = params

  const { data: logRows, error: logError } = await supabase
    .from('email_send_log')
    .upsert({
      message_id: messageId,
      template_name: emailType,
      recipient_email: recipient,
      status: 'pending',
    }, { onConflict: 'message_id', ignoreDuplicates: true })
    .select('message_id')

  if (logError) {
    console.error('Failed to log auth email', { error: logError, run_id: runId, emailType })
    // R3EF-03(a): sin fila de log no hay dedupe posible → NO encolar.
    return { deduplicated: false, logError: true }
  }

  if ((logRows ?? []).length > 0) return { deduplicated: false, logError: false }

  const { data: prev } = await supabase
    .from('email_send_log')
    .select('status, created_at')
    .eq('message_id', messageId)
    .maybeSingle()

  // R3EF-03(b): `pending` vieja ⇒ crash entre upsert y enqueue ⇒ reintentable.
  const prevAntigua = prev?.created_at
    ? Date.now() - new Date(prev.created_at).getTime() > PENDING_STALE_MS
    : false

  if (prev && prev.status !== 'failed' && !(prev.status === 'pending' && prevAntigua)) {
    return { deduplicated: true, logError: false }
  }

  await supabase.from('email_send_log')
    // created_at se refresca a propósito: reinicia la ventana de antigüedad del
    // reintento, si no, un segundo reintento >10 min después volvería a
    // considerarla "crash" aunque el enqueue ya haya ocurrido.
    .update({ status: 'pending', error_message: null, created_at: new Date().toISOString() })
    .eq('message_id', messageId)
  return { deduplicated: false, logError: false }
}
