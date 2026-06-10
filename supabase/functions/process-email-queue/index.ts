import {
  authenticateRequest,
  loadQueueConfig,
  loadFailedAttempts,
} from './queueAuth.ts'
import { processMessage } from './messageProcessor.ts'

const jsonResp = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

interface ProcessQueueArgs {
  supabase: Awaited<ReturnType<typeof authenticateRequest>> extends { supabase: infer S } ? S : never
  queue: string
  batchSize: number
  sendDelayMs: number
  ttlMinutes: number
  apiKey: string
}

async function processQueue(args: ProcessQueueArgs): Promise<{ processed: number; stop?: 'rate_limited' | 'forbidden' }> {
  const { supabase, queue, batchSize, sendDelayMs, ttlMinutes, apiKey } = args
  const { data: messages, error: readError } = await supabase.rpc('read_email_batch', {
    queue_name: queue, batch_size: batchSize, vt: 30,
  })
  if (readError) {
    console.error('Failed to read email batch', { queue, error: readError })
    return { processed: 0 }
  }
  if (!messages?.length) return { processed: 0 }

  const failedAttemptsByMessageId = await loadFailedAttempts(supabase, queue, messages)
  const ctx = { apiKey, ttlMinutes, failedAttemptsByMessageId }

  let processed = 0
  for (let i = 0; i < messages.length; i++) {
    const result = await processMessage(supabase, queue, messages[i], ctx)
    if (result.kind === 'sent') processed++
    if (result.kind === 'stop_rate_limited') return { processed, stop: 'rate_limited' }
    if (result.kind === 'stop_forbidden') return { processed, stop: 'forbidden' }
    if (i < messages.length - 1) {
      await new Promise((r) => setTimeout(r, sendDelayMs))
    }
  }
  return { processed }
}

Deno.serve(async (req) => {
  const auth = authenticateRequest(req)
  if (!auth.ok) return auth.response
  const { supabase, apiKey } = auth

  const config = await loadQueueConfig(supabase)
  if (config.rateLimited) {
    return jsonResp({ skipped: true, reason: 'rate_limited' })
  }

  let totalProcessed = 0
  for (const queue of ['auth_emails', 'transactional_emails']) {
    const res = await processQueue({
      supabase, queue, batchSize: config.batchSize, sendDelayMs: config.sendDelayMs,
      ttlMinutes: config.ttlMinutes[queue], apiKey,
    })
    totalProcessed += res.processed
    if (res.stop) {
      return jsonResp({ processed: totalProcessed, stopped: res.stop })
    }
  }

  return jsonResp({ processed: totalProcessed })
})
