import { sendLovableEmail } from 'npm:@lovable.dev/email-js'
import { createClient } from 'npm:@supabase/supabase-js@2'

const MAX_RETRIES = 5

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
  await supabase.from('email_send_log').insert({
    message_id: payload.message_id,
    template_name: (payload.label || queue) as string,
    recipient_email: payload.to,
    status: 'dlq',
    error_message: reason,
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
    await supabase.from('email_send_log').insert({
      message_id: payload.message_id,
      template_name: payload.label || queue,
      recipient_email: payload.to,
      status: 'rate_limited',
      error_message: errorMsg.slice(0, 1000),
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

  await supabase.from('email_send_log').insert({
    message_id: payload.message_id,
    template_name: payload.label || queue,
    recipient_email: payload.to,
    status: 'failed',
    error_message: errorMsg.slice(0, 1000),
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
    await supabase.from('email_send_log').insert({
      message_id: payload.message_id,
      template_name: payload.label || queue,
      recipient_email: payload.to,
      status: 'sent',
    })
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
