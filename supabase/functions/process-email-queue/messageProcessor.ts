/**
 * Procesa un solo mensaje del email queue. Aísla la lógica de envío,
 * reintento, rate-limit, forbidden y duplicados para reducir la
 * complejidad del handler principal.
 */
import { sendLovableEmail } from 'npm:@lovable.dev/email-js'
import type { createClient } from 'npm:@supabase/supabase-js@2'
import { MAX_RETRIES, moveToDlq } from './queueAuth.ts'

type Supabase = ReturnType<typeof createClient>

export type ProcessResult =
  | { kind: 'sent' }
  | { kind: 'skipped' }
  | { kind: 'stop_rate_limited' }
  | { kind: 'stop_forbidden' }

interface QueueMessage {
  msg_id: number
  read_ct: number
  enqueued_at?: string
  message: Record<string, unknown> & { message_id?: string; to?: string; label?: string; queued_at?: string }
}

interface Ctx {
  apiKey: string
  ttlMinutes: number
  failedAttemptsByMessageId: Map<string, number>
}

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

function getFailedAttempts(msg: QueueMessage, ctx: Ctx): number {
  const id = msg.message?.message_id
  if (typeof id === 'string' && id) return ctx.failedAttemptsByMessageId.get(id) ?? 0
  return msg.read_ct ?? 0
}

async function isExpired(
  supabase: Supabase,
  queue: string,
  msg: QueueMessage,
  ttlMinutes: number,
): Promise<boolean> {
  const queuedAt = msg.message.queued_at ?? msg.enqueued_at
  if (!queuedAt) return false
  const ageMs = Date.now() - new Date(queuedAt).getTime()
  const maxAgeMs = ttlMinutes * 60 * 1000
  if (ageMs <= maxAgeMs) return false
  console.warn('Email expired (TTL exceeded)', {
    queue, msg_id: msg.msg_id, queued_at: queuedAt, ttl_minutes: ttlMinutes,
  })
  await moveToDlq(supabase, queue, msg, `TTL exceeded (${ttlMinutes} minutes)`)
  return true
}

async function isAlreadySent(
  supabase: Supabase,
  queue: string,
  msg: QueueMessage,
): Promise<boolean> {
  const messageId = msg.message.message_id
  if (!messageId) return false
  const { data: alreadySent } = await supabase
    .from('email_send_log')
    .select('id')
    .eq('message_id', messageId)
    .eq('status', 'sent')
    .maybeSingle()
  if (!alreadySent) return false
  console.warn('Skipping duplicate send (already sent)', {
    queue, msg_id: msg.msg_id, message_id: messageId,
  })
  const { error } = await supabase.rpc('delete_email', {
    queue_name: queue, message_id: msg.msg_id,
  })
  if (error) {
    console.error('Failed to delete duplicate message from queue', { queue, msg_id: msg.msg_id, error })
  }
  return true
}

async function handleRateLimit(
  supabase: Supabase, queue: string, msg: QueueMessage, error: unknown, errorMsg: string,
): Promise<void> {
  const payload = msg.message
  await supabase.from('email_send_log').insert({
    message_id: payload.message_id,
    template_name: payload.label || queue,
    recipient_email: payload.to,
    status: 'rate_limited',
    error_message: errorMsg.slice(0, 1000),
  })
  const retryAfterSecs = getRetryAfterSeconds(error)
  await supabase.from('email_send_state').update({
    retry_after_until: new Date(Date.now() + retryAfterSecs * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', 1)
}

async function logFailure(
  supabase: Supabase, queue: string, msg: QueueMessage, errorMsg: string, ctx: Ctx, failedAttempts: number,
): Promise<void> {
  const payload = msg.message
  await supabase.from('email_send_log').insert({
    message_id: payload.message_id,
    template_name: payload.label || queue,
    recipient_email: payload.to,
    status: 'failed',
    error_message: errorMsg.slice(0, 1000),
  })
  if (typeof payload.message_id === 'string' && payload.message_id) {
    ctx.failedAttemptsByMessageId.set(payload.message_id, failedAttempts + 1)
  }
}

async function sendOne(supabase: Supabase, queue: string, msg: QueueMessage, apiKey: string): Promise<void> {
  const payload = msg.message
  await sendLovableEmail(
    {
      run_id: payload.run_id, to: payload.to, from: payload.from,
      sender_domain: payload.sender_domain, subject: payload.subject,
      html: payload.html, text: payload.text, purpose: payload.purpose,
      label: payload.label, idempotency_key: payload.idempotency_key,
      unsubscribe_token: payload.unsubscribe_token, message_id: payload.message_id,
    },
    { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') },
  )
  await supabase.from('email_send_log').insert({
    message_id: payload.message_id,
    template_name: payload.label || queue,
    recipient_email: payload.to,
    status: 'sent',
  })
  const { error: delError } = await supabase.rpc('delete_email', {
    queue_name: queue, message_id: msg.msg_id,
  })
  if (delError) {
    console.error('Failed to delete sent message from queue', { queue, msg_id: msg.msg_id, error: delError })
  }
}

export async function processMessage(
  supabase: Supabase,
  queue: string,
  msg: QueueMessage,
  ctx: Ctx,
): Promise<ProcessResult> {
  const failedAttempts = getFailedAttempts(msg, ctx)

  if (await isExpired(supabase, queue, msg, ctx.ttlMinutes)) return { kind: 'skipped' }

  if (failedAttempts >= MAX_RETRIES) {
    await moveToDlq(
      supabase, queue, msg,
      `Max retries (${MAX_RETRIES}) exceeded (attempted ${failedAttempts} times)`,
    )
    return { kind: 'skipped' }
  }

  if (await isAlreadySent(supabase, queue, msg)) return { kind: 'skipped' }

  try {
    await sendOne(supabase, queue, msg, ctx.apiKey)
    return { kind: 'sent' }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('Email send failed', {
      queue, msg_id: msg.msg_id, read_ct: msg.read_ct, failed_attempts: failedAttempts, error: errorMsg,
    })

    if (isRateLimited(error)) {
      await handleRateLimit(supabase, queue, msg, error, errorMsg)
      return { kind: 'stop_rate_limited' }
    }
    if (isForbidden(error)) {
      await moveToDlq(supabase, queue, msg, errorMsg.slice(0, 1000))
      return { kind: 'stop_forbidden' }
    }
    await logFailure(supabase, queue, msg, errorMsg, ctx, failedAttempts)
    return { kind: 'skipped' }
  }
}
