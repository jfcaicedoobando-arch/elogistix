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
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'

export async function registrarPendiente(
  supabase: SupabaseClient,
  params: { messageId: string; emailType: string; recipient: string; runId: string },
): Promise<{ deduplicated: boolean }> {
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
    return { deduplicated: false }
  }

  if ((logRows ?? []).length > 0) return { deduplicated: false }

  const { data: prev } = await supabase
    .from('email_send_log')
    .select('status')
    .eq('message_id', messageId)
    .maybeSingle()

  if (prev && prev.status !== 'failed') return { deduplicated: true }

  await supabase.from('email_send_log')
    .update({ status: 'pending', error_message: null })
    .eq('message_id', messageId)
  return { deduplicated: false }
}
