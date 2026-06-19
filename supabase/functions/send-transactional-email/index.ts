import * as React from 'npm:react@18.3.1'
import { wrapEdgeHandler } from "../_shared/sentry.ts"
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'
import { parseRequest, corsResponse } from './validation.ts'
import { getOrCreateUnsubscribeToken } from './unsubscribeToken.ts'

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
  try {
    const anonClient = createClient(env.supabaseUrl, env.supabaseAnonKey)
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token)
    if (claimsError || claimsData?.claims?.role !== 'service_role') {
      return corsResponse({ error: 'Forbidden' }, 403)
    }
  } catch (e) {
    console.error('JWT verification failed', e)
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
    console.error('Suppression check failed — refusing to send', { error: suppressionError, effectiveRecipient: meta.effectiveRecipient })
    return corsResponse({ error: 'Failed to verify suppression status' }, 500)
  }

  if (suppressed) {
    await supabase.from('email_send_log').insert({
      message_id: meta.messageId, template_name: meta.templateName,
      recipient_email: meta.effectiveRecipient, status: 'suppressed',
    })
    console.log('Email suppressed', { effectiveRecipient: meta.effectiveRecipient, templateName: meta.templateName })
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
    await supabase.from('email_send_log').insert({
      message_id: meta.messageId, template_name: meta.templateName,
      recipient_email: meta.effectiveRecipient, status: 'suppressed',
      error_message: 'Unsubscribe token used but email missing from suppressed list',
    })
    return corsResponse({ success: false, reason: 'email_suppressed' })
  }
  if ('tokenError' in tokenResult) {
    await supabase.from('email_send_log').insert({
      message_id: meta.messageId, template_name: meta.templateName,
      recipient_email: meta.effectiveRecipient, status: 'failed',
      error_message: tokenResult.tokenError,
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

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId, template_name: templateName,
    recipient_email: effectiveRecipient, status: 'pending',
  })

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
    console.error('Failed to enqueue email', { error: enqueueError, templateName, effectiveRecipient })
    await supabase.from('email_send_log').insert({
      message_id: messageId, template_name: templateName,
      recipient_email: effectiveRecipient, status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return corsResponse({ error: 'Failed to enqueue email' }, 500)
  }

  console.log('Transactional email enqueued', { templateName, effectiveRecipient })
  return corsResponse({ success: true, queued: true })
}))
