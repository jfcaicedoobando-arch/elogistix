import { sendLovableEmail } from 'npm:@lovable.dev/email-js'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const MAX_RETRIES = 5
import { registrarEstadoEmail } from '../_shared/emailSendLog.ts'

export interface QueueMessage {
  msg_id: number
  message: Record<string, unknown>
  read_ct: number
  enqueued_at?: string
}

export interface ProcessCtx {
  supabase: ReturnType<typeof createClient>
  apiKey: string
  queue: string
  ttlMinutes: number
  sendUrl: string | undefined
}

export type ProcessResult =
  | { status: 'sent' | 'expired' | 'max_retries' | 'duplicate' | 'failed' }
  | { status: 'rate_limited' }
  | { status: 'forbidden' }

function isRateLimited(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 429
  }
  return error instanceof Error && error.message.includes('429')
}

function isForbidden(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 403
  }
  return error instanceof Error && error.message.includes('403')
}

function getRetryAfterSeconds(error: unknown): number {
  if (error && typeof error === 'object' && 'retryAfterSeconds' in error) {
    return (error as { retryAfterSeconds: number | null }).retryAfterSeconds ?? 60
  }
  return 60
}

export async function moveToDlq(
  supabase: ReturnType<typeof createClient>,
  queue: string,
  msg: QueueMessage,
  reason: string
): Promise<void> {
  const payload = msg.message
  // R3 · P2: upsert por message_id — el insert repetido reventaba 23505 en
  // silencio contra uq_email_send_log_message_id y el estado nunca se marcaba.
  await registrarEstadoEmail(supabase, {
    messageId: payload.message_id,
    templateName: (payload.label || queue) as string,
    recipientEmail: payload.to,
    status: 'dlq',
    errorMessage: reason,
  })
  const { error } = await supabase.rpc('move_to_dlq', {
    source_queue: queue,
    dlq_name: `${queue}_dlq`,
    message_id: msg.msg_id,
    payload,
  })
  if (error) {
    console.error('Failed to move message to DLQ', { queue, msg_id: msg.msg_id, reason, error })
  }
}

async function checkAndDeleteDuplicate(
  supabase: ReturnType<typeof createClient>,
  queue: string,
  msg: QueueMessage
): Promise<boolean> {
  const payload = msg.message
  if (!payload.message_id) return false
  const { data: alreadySent } = await supabase
    .from('email_send_log')
    .select('id')
    .eq('message_id', payload.message_id)
    .eq('status', 'sent')
    .maybeSingle()
  if (!alreadySent) return false
  console.warn('Skipping duplicate send (already sent)', {
    queue, msg_id: msg.msg_id, message_id: payload.message_id,
  })
  const { error: dupDelError } = await supabase.rpc('delete_email', {
    queue_name: queue,
    message_id: msg.msg_id,
  })
  if (dupDelError) {
    console.error('Failed to delete duplicate message from queue', { queue, msg_id: msg.msg_id, error: dupDelError })
  }
  return true
}

/**
 * W-11 (auditoría R2): claim atómico ANTES de llamar al proveedor.
 *
 * Antes el estado 'sent' se marcaba DESPUÉS de enviar: si dos corridas del cron
 * tomaban el mismo mensaje (visibility timeout de pgmq expirado o traslape de
 * schedule), ambas veían "no enviado" y el correo salía dos veces. Ahora se
 * marca 'sent' con un UPDATE condicionado a estado no-final; Postgres serializa
 * el row-lock, así que la segunda corrida actualiza 0 filas y aborta como
 * duplicado. Si el proveedor falla después, `handleSendError` regresa la fila a
 * 'failed'/'rate_limited' y el mensaje se reintenta normalmente.
 *
 * Devuelve `true` si esta corrida se adjudicó el envío.
 */
async function claimSendAtomico(
  supabase: ReturnType<typeof createClient>,
  queue: string,
  msg: QueueMessage,
): Promise<boolean> {
  const payload = msg.message
  const messageId = payload.message_id
  // Sin `message_id` no hay clave de deduplicación: se envía sin claim (mismo
  // comportamiento que `checkAndDeleteDuplicate`).
  if (typeof messageId !== 'string' || !messageId) return true

  const { data: claimed, error } = await supabase
    .from('email_send_log')
    .update({ status: 'sent' })
    .eq('message_id', messageId)
    .not('status', 'in', '("sent","dlq")')
    .select('id')
  if (error) {
    console.error('Failed to claim email send', { queue, msg_id: msg.msg_id, message_id: messageId, error: error.message })
    return false
  }
  if (claimed && claimed.length > 0) return true

  // 0 filas: o ya está en estado final (duplicado real) o la fila 'pending'
  // nunca se creó. Sólo en el segundo caso se debe enviar.
  const { data: existente } = await supabase
    .from('email_send_log')
    .select('id')
    .eq('message_id', messageId)
    .maybeSingle()
  if (existente) {
    console.warn('Skipping duplicate send (claim perdido)', { queue, msg_id: msg.msg_id, message_id: messageId })
    return false
  }
  await registrarEstadoEmail(supabase, {
    messageId,
    templateName: (payload.label || queue) as string,
    recipientEmail: payload.to,
    status: 'sent',
  })
  return true
}

async function handleSendError(
  error: unknown,
  ctx: ProcessCtx,
  msg: QueueMessage,
  failedAttempts: number
): Promise<ProcessResult> {
  const { supabase, queue } = ctx
  const payload = msg.message
  const errorMsg = error instanceof Error ? error.message : String(error)
  console.error('Email send failed', { queue, msg_id: msg.msg_id, read_ct: msg.read_ct, failed_attempts: failedAttempts, error: errorMsg })

  if (isRateLimited(error)) {
    await registrarEstadoEmail(supabase, {
      messageId: payload.message_id,
      templateName: payload.label || queue,
      recipientEmail: payload.to,
      status: 'rate_limited',
      errorMessage: errorMsg.slice(0, 1000),
    })
    const retryAfterSecs = getRetryAfterSeconds(error)
    await supabase
      .from('email_send_state')
      .update({ retry_after_until: new Date(Date.now() + retryAfterSecs * 1000).toISOString(), updated_at: new Date().toISOString() })
      .eq('id', 1)
    return { status: 'rate_limited' }
  }

  if (isForbidden(error)) {
    await moveToDlq(supabase, queue, msg, errorMsg.slice(0, 1000))
    return { status: 'forbidden' }
  }

  await registrarEstadoEmail(supabase, {
    messageId: payload.message_id,
    templateName: payload.label || queue,
    recipientEmail: payload.to,
    status: 'failed',
    errorMessage: errorMsg.slice(0, 1000),
  })
  return { status: 'failed' }
}

export async function processMessage(
  ctx: ProcessCtx,
  msg: QueueMessage,
  failedAttempts: number
): Promise<ProcessResult> {
  const { supabase, queue, ttlMinutes, apiKey, sendUrl } = ctx
  const payload = msg.message

  const queuedAt = payload.queued_at ?? msg.enqueued_at
  if (queuedAt) {
    const ageMs = Date.now() - new Date(queuedAt as string).getTime()
    if (ageMs > ttlMinutes * 60 * 1000) {
      console.warn('Email expired (TTL exceeded)', { queue, msg_id: msg.msg_id, queued_at: queuedAt, ttl_minutes: ttlMinutes })
      await moveToDlq(supabase, queue, msg, `TTL exceeded (${ttlMinutes} minutes)`)
      return { status: 'expired' }
    }
  }

  if (failedAttempts >= MAX_RETRIES) {
    await moveToDlq(supabase, queue, msg, `Max retries (${MAX_RETRIES}) exceeded (attempted ${failedAttempts} times)`)
    return { status: 'max_retries' }
  }

  const isDuplicate = await checkAndDeleteDuplicate(supabase, queue, msg)
  if (isDuplicate) return { status: 'duplicate' }

  // W-11: claim atómico pre-envío. Si otra corrida ya se adjudicó el mensaje,
  // se aborta sin llamar al proveedor (evita el correo duplicado).
  const claimed = await claimSendAtomico(supabase, queue, msg)
  if (!claimed) return { status: 'duplicate' }

  try {
    await sendLovableEmail(
      {
        run_id: payload.run_id, to: payload.to, from: payload.from,
        sender_domain: payload.sender_domain, subject: payload.subject,
        html: payload.html, text: payload.text, purpose: payload.purpose,
        label: payload.label, idempotency_key: payload.idempotency_key,
        unsubscribe_token: payload.unsubscribe_token, message_id: payload.message_id,
      },
      { apiKey, sendUrl }
    )

    const { error: delError } = await supabase.rpc('delete_email', {
      queue_name: queue,
      message_id: msg.msg_id,
    })
    if (delError) {
      console.error('Failed to delete sent message from queue', { queue, msg_id: msg.msg_id, error: delError })
    }
    return { status: 'sent' }
  } catch (error) {
    return handleSendError(error, ctx, msg, failedAttempts)
  }
}
