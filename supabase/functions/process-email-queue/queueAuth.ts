/**
 * Helpers de auth, configuración y DLQ para process-email-queue.
 * Extraído del index.ts para reducir complejidad ciclomática.
 */
import { createClient } from 'npm:@supabase/supabase-js@2'

declare const Deno: { env: { get(key: string): string | undefined } }

export const MAX_RETRIES = 5
export const DEFAULT_BATCH_SIZE = 10
export const DEFAULT_SEND_DELAY_MS = 200
export const DEFAULT_AUTH_TTL_MINUTES = 15
export const DEFAULT_TRANSACTIONAL_TTL_MINUTES = 60

export interface QueueConfig {
  batchSize: number
  sendDelayMs: number
  ttlMinutes: Record<string, number>
  rateLimited: boolean
}

async function verifyServiceRoleToken(token: string, supabaseUrl: string): Promise<boolean> {
  // Verifica la firma del JWT contra el proyecto y exige role=service_role.
  // Reemplaza el decode manual base64 (vulnerable a tokens forjados).
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!anonKey) {
    console.error('verifyServiceRoleToken: SUPABASE_ANON_KEY missing')
    return false
  }
  try {
    const anonClient = createClient(supabaseUrl, anonKey)
    const { data, error } = await anonClient.auth.getClaims(token)
    if (error) {
      console.error('verifyServiceRoleToken: getClaims error', { message: error.message, name: error.name })
      return false
    }
    if (!data?.claims) {
      console.error('verifyServiceRoleToken: no claims returned', { tokenLen: token.length })
      return false
    }
    const role = (data.claims as { role?: string }).role
    if (role !== 'service_role') {
      console.error('verifyServiceRoleToken: role mismatch', { role })
      return false
    }
    return true
  } catch (e) {
    console.error('verifyServiceRoleToken: exception', e)
    return false
  }
}

const jsonResp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export interface AuthOk {
  ok: true
  supabase: ReturnType<typeof createClient>
  apiKey: string
}
export interface AuthFail {
  ok: false
  response: Response
}

export async function authenticateRequest(req: Request): Promise<AuthOk | AuthFail> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return { ok: false, response: jsonResp({ error: 'Server configuration error' }, 500) }
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, response: jsonResp({ error: 'Unauthorized' }, 401) }
  }

  const token = authHeader.slice('Bearer '.length).trim()
  const isServiceRole = await verifyServiceRoleToken(token, supabaseUrl)
  if (!isServiceRole) {
    return { ok: false, response: jsonResp({ error: 'Forbidden' }, 403) }
  }

  return { ok: true, supabase: createClient(supabaseUrl, supabaseServiceKey), apiKey }
}

export async function loadQueueConfig(
  supabase: ReturnType<typeof createClient>,
): Promise<QueueConfig> {
  const { data: state } = await supabase
    .from('email_send_state')
    .select('retry_after_until, batch_size, send_delay_ms, auth_email_ttl_minutes, transactional_email_ttl_minutes')
    .single()

  const rateLimited =
    !!state?.retry_after_until && new Date(state.retry_after_until) > new Date()

  return {
    batchSize: state?.batch_size ?? DEFAULT_BATCH_SIZE,
    sendDelayMs: state?.send_delay_ms ?? DEFAULT_SEND_DELAY_MS,
    ttlMinutes: {
      auth_emails: state?.auth_email_ttl_minutes ?? DEFAULT_AUTH_TTL_MINUTES,
      transactional_emails:
        state?.transactional_email_ttl_minutes ?? DEFAULT_TRANSACTIONAL_TTL_MINUTES,
    },
    rateLimited,
  }
}

export async function moveToDlq(
  supabase: ReturnType<typeof createClient>,
  queue: string,
  msg: { msg_id: number; message: Record<string, unknown> },
  reason: string,
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

export async function loadFailedAttempts(
  supabase: ReturnType<typeof createClient>,
  queue: string,
  messages: Array<{ message: { message_id?: unknown } }>,
): Promise<Map<string, number>> {
  const messageIds = Array.from(
    new Set(
      messages
        .map((m) =>
          m?.message?.message_id && typeof m.message.message_id === 'string'
            ? m.message.message_id
            : null,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  )
  const result = new Map<string, number>()
  if (messageIds.length === 0) return result

  const { data: failedRows, error } = await supabase
    .from('email_send_log')
    .select('message_id')
    .in('message_id', messageIds)
    .eq('status', 'failed')

  if (error) {
    console.error('Failed to load failed-attempt counters', { queue, error })
    return result
  }
  for (const row of failedRows ?? []) {
    const id = row?.message_id
    if (typeof id !== 'string' || !id) continue
    result.set(id, (result.get(id) ?? 0) + 1)
  }
  return result
}
