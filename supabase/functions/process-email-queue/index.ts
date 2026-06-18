import { createClient } from 'npm:@supabase/supabase-js@2'
import { wrapEdgeHandler } from "../_shared/sentry.ts"
import { processQueue } from './queueProcessor.ts'

const DEFAULT_BATCH_SIZE = 10
const DEFAULT_SEND_DELAY_MS = 200
const DEFAULT_AUTH_TTL_MINUTES = 15
const DEFAULT_TRANSACTIONAL_TTL_MINUTES = 60

async function verifyServiceRoleToken(token: string, supabaseUrl: string): Promise<boolean> {
  // Verifica firma del JWT contra el proyecto y exige role=service_role.
  // Reemplaza el decode manual base64 (vulnerable a tokens forjados).
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!anonKey) return false
  try {
    const anonClient = createClient(supabaseUrl, anonKey)
    const { data, error } = await anonClient.auth.getClaims(token)
    if (error || !data?.claims) return false
    return data.claims.role === 'service_role'
  } catch (e) {
    console.error('JWT verification failed', e)
    return false
  }
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

interface QueueEnv {
  apiKey: string;
  supabaseUrl: string;
  supabaseServiceKey: string;
}

function loadEnv(): QueueEnv | Response {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }
  return { apiKey, supabaseUrl, supabaseServiceKey }
}

// authenticateRequest: verifica JWT service_role en defensa en profundidad
function authenticateRequest(req: Request): Response | null {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }
  const token = authHeader.slice('Bearer '.length).trim()
  const claims = parseJwtClaims(token)
  if (claims?.role !== 'service_role') {
    return jsonResponse({ error: 'Forbidden' }, 403)
  }
  return null
}

interface QueueConfig {
  batchSize: number;
  sendDelayMs: number;
  ttlMinutes: Record<string, number>;
  rateLimited: boolean;
}

async function loadConfig(supabase: ReturnType<typeof createClient>): Promise<QueueConfig> {
  const { data: state } = await supabase
    .from('email_send_state')
    .select('retry_after_until, batch_size, send_delay_ms, auth_email_ttl_minutes, transactional_email_ttl_minutes')
    .single()

  const rateLimited = !!(state?.retry_after_until && new Date(state.retry_after_until) > new Date())
  return {
    batchSize: state?.batch_size ?? DEFAULT_BATCH_SIZE,
    sendDelayMs: state?.send_delay_ms ?? DEFAULT_SEND_DELAY_MS,
    ttlMinutes: {
      auth_emails: state?.auth_email_ttl_minutes ?? DEFAULT_AUTH_TTL_MINUTES,
      transactional_emails: state?.transactional_email_ttl_minutes ?? DEFAULT_TRANSACTIONAL_TTL_MINUTES,
    },
    rateLimited,
  }
}

Deno.serve(wrapEdgeHandler("process-email-queue", async (req) => {
  const env = loadEnv()
  if (env instanceof Response) return env

  const authErr = authenticateRequest(req)
  if (authErr) return authErr

  const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey)
  const config = await loadConfig(supabase)
  if (config.rateLimited) return jsonResponse({ skipped: true, reason: 'rate_limited' })

  const sendUrl = Deno.env.get('LOVABLE_SEND_URL')
  let totalProcessed = 0

  for (const queue of ['auth_emails', 'transactional_emails']) {
    const result = await processQueue(
      { supabase, apiKey: env.apiKey, queue, ttlMinutes: config.ttlMinutes[queue], sendUrl },
      config.batchSize,
      config.sendDelayMs,
    )
    totalProcessed += result.totalProcessed
    if (result.stopped) {
      return jsonResponse({ processed: totalProcessed, stopped: result.stopped })
    }
  }

  return jsonResponse({ processed: totalProcessed })
}))
