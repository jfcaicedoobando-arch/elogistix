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

// eslint-disable-next-line complexity -- Handler de edge function con múltiples ramas de validación; refactor pendiente.
Deno.serve(wrapEdgeHandler("send-transactional-email", async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    console.error('Missing required environment variables')
    return corsResponse({ error: 'Server configuration error' }, 500)
  }

  // Auth: solo aceptamos service_role JWT verificado (callers server-to-server).
  // Bloquea relay de email abierto desde Internet.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return corsResponse({ error: 'Unauthorized' }, 401)
  }
  const token = authHeader.slice('Bearer '.length).trim()
  try {
    const anonClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token)
    if (claimsError || claimsData?.claims?.role !== 'service_role') {
      return corsResponse({ error: 'Forbidden' }, 403)
    }
  } catch (e) {
    console.error('JWT verification failed', e)
    return corsResponse({ error: 'Forbidden' }, 403)
  }

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

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const normalizedEmail = effectiveRecipient.toLowerCase()

  // Check suppression list (fail-closed)
  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (suppressionError) {
    console.error('Suppression check failed — refusing to send', { error: suppressionError, effectiveRecipient })
    return corsResponse({ error: 'Failed to verify suppression status' }, 500)
  }

  if (suppressed) {
    await supabase.from('email_send_log').insert({
      message_id: messageId, template_name: templateName,
      recipient_email: effectiveRecipient, status: 'suppressed',
    })
    console.log('Email suppressed', { effectiveRecipient, templateName })
    return corsResponse({ success: false, reason: 'email_suppressed' })
  }

  // Get or create unsubscribe token
  const tokenResult = await getOrCreateUnsubscribeToken(supabase, normalizedEmail)

  if ('suppressed' in tokenResult) {
    await supabase.from('email_send_log').insert({
      message_id: messageId, template_name: templateName,
      recipient_email: effectiveRecipient, status: 'suppressed',
      error_message: 'Unsubscribe token used but email missing from suppressed list',
    })
    return corsResponse({ success: false, reason: 'email_suppressed' })
  }

  if ('tokenError' in tokenResult) {
    await supabase.from('email_send_log').insert({
      message_id: messageId, template_name: templateName,
      recipient_email: effectiveRecipient, status: 'failed',
      error_message: tokenResult.tokenError,
    })
    return corsResponse({ error: 'Failed to prepare email' }, 500)
  }

  const { token: unsubscribeToken } = tokenResult

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
