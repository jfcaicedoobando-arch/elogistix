import * as React from 'npm:react@18.3.1'
import { wrapEdgeHandler } from "../_shared/sentry.ts"
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { corsHeaders } from "../_shared/cors.ts"
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { parseRequest, corsResponse } from './validation.ts'
import { getOrCreateUnsubscribeToken } from './unsubscribeToken.ts'
import { timingSafeEqual } from '../_shared/timingSafe.ts'
import { registrarEstadoEmail } from '../_shared/emailSendLog.ts'
import { maskEmail } from '../_shared/redact.ts'

const SITE_NAME = "elogistix"
const SENDER_DOMAIN = "notify.librecarga.com"
const FROM_DOMAIN = "librecarga.com"

interface EnvVars {
  supabaseUrl: string
  supabaseServiceKey: string
  supabaseAnonKey: string
}

function loadEnvOrFail(): EnvVars | Response {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.error('Missing required environment variables')
    return corsResponse({ error: 'Server configuration error' }, 500)
  }
  return { supabaseUrl, supabaseServiceKey, supabaseAnonKey }
}

async function verifyServiceRoleOrFail(req: Request, env: EnvVars): Promise<Response | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return corsResponse({ error: 'Unauthorized' }, 401)
  }
  const token = authHeader.slice('Bearer '.length).trim()
  // Server-to-server only: compara directamente contra SUPABASE_SERVICE_ROLE_KEY.
  // Más estricto que validar `claims.role === 'service_role'` y evita fallas de
  // `getClaims()` cuando el JWT del service role no se puede verificar localmente.
  // R4EF-05: comparación constante en tiempo (patrón queueAuth.ts); antes `!==`.
  if (!timingSafeEqual(token, env.supabaseServiceKey)) {
    return corsResponse({ error: 'Forbidden' }, 403)
  }
  return null
}

type SupabaseAdmin = ReturnType<typeof createClient>

async function checkSuppressionOrFail(
  supabase: SupabaseAdmin,
  normalizedEmail: string,
  meta: { messageId: string; templateName: string; effectiveRecipient: string },
): Promise<Response | null> {
  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (suppressionError) {
    console.error('Suppression check failed — refusing to send', { error: suppressionError, effectiveRecipient: maskEmail(meta.effectiveRecipient) })
    return corsResponse({ error: 'Failed to verify suppression status' }, 500)
  }

  if (suppressed) {
    await registrarEstadoEmail(supabase, {
      messageId: meta.messageId, templateName: meta.templateName,
      recipientEmail: meta.effectiveRecipient, status: 'suppressed',
    })
    console.log('Email suppressed', { effectiveRecipient: maskEmail(meta.effectiveRecipient), templateName: meta.templateName })
    return corsResponse({ success: false, reason: 'email_suppressed' })
  }
  return null
}

async function resolveUnsubscribeOrFail(
  supabase: SupabaseAdmin,
  normalizedEmail: string,
  meta: { messageId: string; templateName: string; effectiveRecipient: string },
): Promise<{ token: string } | Response> {
  const tokenResult = await getOrCreateUnsubscribeToken(supabase, normalizedEmail)
  if ('suppressed' in tokenResult) {
    await registrarEstadoEmail(supabase, {
      messageId: meta.messageId, templateName: meta.templateName,
      recipientEmail: meta.effectiveRecipient, status: 'suppressed',
      errorMessage: 'Unsubscribe token used but email missing from suppressed list',
    })
    return corsResponse({ success: false, reason: 'email_suppressed' })
  }
  if ('tokenError' in tokenResult) {
    await registrarEstadoEmail(supabase, {
      messageId: meta.messageId, templateName: meta.templateName,
      recipientEmail: meta.effectiveRecipient, status: 'failed',
      errorMessage: tokenResult.tokenError,
    })
    return corsResponse({ error: 'Failed to prepare email' }, 500)
  }
  return { token: tokenResult.token }
}

Deno.serve(wrapEdgeHandler("send-transactional-email", async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const env = loadEnvOrFail()
  if (env instanceof Response) return env

  const authFail = await verifyServiceRoleOrFail(req, env)
  if (authFail) return authFail

  const parsed = await parseRequest(req)
  if (parsed instanceof Response) return parsed

  const { templateName, recipientEmail, messageId, idempotencyKey, templateData } = parsed

  const template = TEMPLATES[templateName]
  if (!template) {
    console.error('Template not found in registry', { templateName })
    return corsResponse(
      { error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}` },
      404
    )
  }

  const effectiveRecipient = template.to || recipientEmail
  if (!effectiveRecipient) {
    return corsResponse(
      { error: 'recipientEmail is required (unless the template defines a fixed recipient)' },
      400
    )
  }

  const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey)
  const normalizedEmail = effectiveRecipient.toLowerCase()
  const meta = { messageId, templateName, effectiveRecipient }

  const suppressionFail = await checkSuppressionOrFail(supabase, normalizedEmail, meta)
  if (suppressionFail) return suppressionFail

  const unsubResult = await resolveUnsubscribeOrFail(supabase, normalizedEmail, meta)
  if (unsubResult instanceof Response) return unsubResult
  const { token: unsubscribeToken } = unsubResult

  // Render React Email template to HTML and plain text
  const html = await renderAsync(React.createElement(template.component, templateData))
  const plainText = await renderAsync(
    React.createElement(template.component, templateData),
    { plainText: true }
  )
  const resolvedSubject =
    typeof template.subject === 'function' ? template.subject(templateData) : template.subject

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes.
  // R3 · P2: upsert con ignoreDuplicates — un reintento del caller con el
  // mismo message_id no debe reventar 23505 ni pisar un estado posterior
  // ('sent'), que la cola usa para deduplicar (isAlreadySent).
  const { error: pendingError } = await supabase.from('email_send_log').upsert({
    message_id: messageId, template_name: templateName,
    recipient_email: effectiveRecipient, status: 'pending',
  }, { onConflict: 'message_id', ignoreDuplicates: true })
  if (pendingError) {
    console.error('Failed to log pending email', { error: pendingError, templateName })
  }

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue email', { error: enqueueError, templateName, effectiveRecipient: maskEmail(effectiveRecipient) })
    // R3 · P2: la fila 'pending' ya existe con este message_id — un segundo
    // INSERT revienta el índice único (23505) y dejaba la fila zombie en
    // 'pending' sin registrar el fallo. Upsert por message_id vía RPC.
    await registrarEstadoEmail(supabase, {
      messageId: messageId, templateName: templateName,
      recipientEmail: effectiveRecipient, status: 'failed',
      errorMessage: 'Failed to enqueue email',
    })
    return corsResponse({ error: 'Failed to enqueue email' }, 500)
  }

  console.log('Transactional email enqueued', { templateName, effectiveRecipient: maskEmail(effectiveRecipient) })
  return corsResponse({ success: true, queued: true })
}))
