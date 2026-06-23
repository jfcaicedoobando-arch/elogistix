import { createClient } from 'npm:@supabase/supabase-js@2'
import { captureEdgeException } from '../_shared/sentry.ts'
import { processMessage, ProcessCtx, QueueMessage } from './processItem.ts'

export interface QueueResult {
  totalProcessed: number
  stopped?: string
}

function extractMessageIds(messages: QueueMessage[]): string[] {
  return Array.from(new Set(
    messages
      .map((msg) => {
        const id = msg?.message?.message_id
        return typeof id === 'string' && id ? id : null
      })
      .filter((id): id is string => Boolean(id))
  ))
}

async function buildFailedAttemptsMap(
  supabase: ReturnType<typeof createClient>,
  messageIds: string[],
  queue: string
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (messageIds.length === 0) return map
  const { data: failedRows, error } = await supabase
    .from('email_send_log')
    .select('message_id')
    .in('message_id', messageIds)
    .eq('status', 'failed')
  if (error) {
    console.error('Failed to load failed-attempt counters', { queue, error })
    return map
  }
  for (const row of failedRows ?? []) {
    const id = row?.message_id
    if (typeof id !== 'string' || !id) continue
    map.set(id, (map.get(id) ?? 0) + 1)
  }
  return map
}

function getFailedAttempts(msg: QueueMessage, map: Map<string, number>): number {
  const payload = msg.message
  if (payload?.message_id && typeof payload.message_id === 'string') {
    return map.get(payload.message_id) ?? 0
  }
  return msg.read_ct ?? 0
}

export async function processQueue(
  ctx: ProcessCtx,
  batchSize: number,
  sendDelayMs: number
): Promise<QueueResult> {
  const { supabase, queue } = ctx
  const { data: messages, error: readError } = await supabase.rpc('read_email_batch', {
    queue_name: queue,
    batch_size: batchSize,
    vt: 30,
  })
  if (readError) {
    console.error('Failed to read email batch', { queue, error: readError })
    // 13.114.20: si la cola falla al leer batch, el cron termina sin error pero
    // SIN PROCESAR. Antes era invisible — ahora Sentry recibe alerta.
    await captureEdgeException(readError, {
      fn: 'process-email-queue',
      extra: { phase: 'read_batch', queue },
    })
    return { totalProcessed: 0 }
  }
  if (!messages?.length) return { totalProcessed: 0 }

  const messageIds = extractMessageIds(messages)
  const failedAttemptsMap = await buildFailedAttemptsMap(supabase, messageIds, queue)

  let totalProcessed = 0
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const failedAttempts = getFailedAttempts(msg, failedAttemptsMap)
    const result = await processMessage(ctx, msg, failedAttempts)

    if (result.status === 'rate_limited') return { totalProcessed, stopped: 'rate_limited' }
    if (result.status === 'forbidden') return { totalProcessed, stopped: 'forbidden' }
    if (result.status === 'sent') totalProcessed++
    if (result.status === 'failed') {
      const id = msg.message?.message_id
      if (typeof id === 'string' && id) failedAttemptsMap.set(id, failedAttempts + 1)
    }
    if (i < messages.length - 1) await new Promise((r) => setTimeout(r, sendDelayMs))
  }
  return { totalProcessed }
}
