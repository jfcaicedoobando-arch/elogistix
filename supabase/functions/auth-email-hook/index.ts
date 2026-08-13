import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { parseEmailWebhookPayload } from 'npm:@lovable.dev/email-js'
import { WebhookError, verifyWebhookRequest } from 'npm:@lovable.dev/webhooks-js'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { initSentryEdge, captureEdgeException } from '../_shared/sentry.ts'
import {
  EMAIL_SUBJECTS,
  EMAIL_TEMPLATES,
  SITE_NAME,
  SENDER_DOMAIN,
  ROOT_DOMAIN,
  FROM_DOMAIN,
} from './templates.ts'
import { handlePreview } from './preview.ts'
import { registrarPendiente } from './dedupe.ts'

initSentryEdge('auth-email-hook')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-lovable-signature, x-lovable-timestamp, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

/** REF-04: nunca loguear el email completo (PII). Conserva el dominio para diagnóstico. */
function enmascararEmail(email: string): string {
  const at = email.indexOf('@')
  if (at <= 0) return '***'
  return `***@${email.slice(at + 1)}`
}

/** Payload del hook de correos de auth (v1). */
interface AuthHookPayload {
  version?: string
  run_id?: string
  data: {
    action_type: string
    email: string
    url?: string
    token?: string
    old_email?: string
    new_email?: string
  }
}



/**
 * RTC-01: verificación + parseo del webhook extraídos del handler para bajar
 * su complejidad ciclomática (límite 16). Devuelve el payload o la respuesta
 * de error ya formada.
 */
async function verificarYParsear(
  req: Request,
  apiKey: string,
): Promise<{ payload: AuthHookPayload } | Response> {
  try {
    const verified = await verifyWebhookRequest({
      req,
      secret: apiKey,
      parser: parseEmailWebhookPayload,
    })
    return { payload: verified.payload as AuthHookPayload }
  } catch (error) {
    return respuestaErrorWebhook(error)
  }
}

/** Traduce un fallo de verificación/parseo a la respuesta HTTP correspondiente. */
function respuestaErrorWebhook(error: unknown): Response {
  const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }
  if (error instanceof WebhookError) {
    const esFirma = error.code === 'invalid_signature' ||
      error.code === 'missing_timestamp' ||
      error.code === 'invalid_timestamp' ||
      error.code === 'stale_timestamp'
    if (esFirma) {
      console.error('Invalid webhook signature', { error: error.message })
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: jsonHeaders })
    }
    if (error.code === 'invalid_payload' || error.code === 'invalid_json') {
      console.error('Invalid webhook payload', { error: error.message })
      return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), { status: 400, headers: jsonHeaders })
    }
  }
  console.error('Webhook verification failed', { error })
  return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), { status: 400, headers: jsonHeaders })
}

// Webhook handler - verifies signature and sends email
async function handleWebhook(req: Request): Promise<Response> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')

  if (!apiKey) {
    console.error('LOVABLE_API_KEY not configured')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Verify signature + timestamp, then parse payload (ver verificarYParsear).
  const verificado = await verificarYParsear(req, apiKey)
  if (verificado instanceof Response) return verificado
  const payload = verificado.payload
  const run_id = payload.run_id ?? ''

  if (!run_id) {
    console.error('Webhook payload missing run_id')
    return new Response(
      JSON.stringify({ error: 'Invalid webhook payload' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (payload.version !== '1') {
    console.error('Unsupported payload version', { version: payload.version, run_id })
    return new Response(
      JSON.stringify({ error: `Unsupported payload version: ${payload.version}` }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // The email action type is in payload.data.action_type (e.g., "signup", "recovery")
  // payload.type is the hook event type ("auth")
  const emailType = payload.data.action_type
  console.log('Received auth event', { emailType, email: enmascararEmail(payload.data.email), run_id })

  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    console.error('Unknown email type', { emailType, run_id })
    return new Response(
      JSON.stringify({ error: `Unknown email type: ${emailType}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Build template props from payload.data (HookData structure)
  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: `https://${ROOT_DOMAIN}`,
    recipient: payload.data.email,
    confirmationUrl: payload.data.url,
    token: payload.data.token,
    email: payload.data.email,
    oldEmail: payload.data.old_email,
    newEmail: payload.data.new_email,
  }

  // Render React Email to HTML and plain text
  const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
  const text = await renderAsync(React.createElement(EmailTemplate, templateProps), {
    plainText: true,
  })

  // Enqueue email for async processing by the dispatcher (process-email-queue).
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // REF-03: message_id determinista por run_id — el reintento del hook de
  // Supabase Auth reutiliza el mismo run_id y NO debe re-encolar el correo ni
  // duplicar filas en email_send_log (índice uq_email_send_log_message_id).
  const messageId = `auth-${run_id}`

  const dedupe = await registrarPendiente(supabase, {
    messageId,
    emailType,
    recipient: payload.data.email,
    runId: run_id,
  })
  // R3EF-03(a): fail-closed — sin fila en email_send_log no se puede
  // deduplicar el reintento ni registrar el fallo del enqueue. El hook de
  // Supabase Auth reintenta con el mismo run_id, así que el 500 es seguro.
  if (dedupe.logError) {
    await captureEdgeException(new Error('email_send_log upsert failed'), {
      fn: 'auth-email-hook',
      extra: { emailType, run_id },
    })
    return new Response(
      JSON.stringify({ error: 'auth_email_log_unavailable' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  if (dedupe.deduplicated) {
    console.log('Auth email hook deduplicated', { emailType, run_id })
    return new Response(
      JSON.stringify({ success: true, queued: true, deduplicated: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'auth_emails',
    payload: {
      run_id,
      message_id: messageId,
      to: payload.data.email,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: EMAIL_SUBJECTS[emailType] || 'Notification',
      html,
      text,
      purpose: 'transactional',
      label: emailType,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue auth email', { error: enqueueError, run_id, emailType })
    // REF-03: marcar la MISMA fila como failed (antes se insertaba una segunda
    // fila y la 'pending' quedaba huérfana para siempre).
    await supabase.from('email_send_log')
      .update({ status: 'failed', error_message: 'Failed to enqueue email' })
      .eq('message_id', messageId)
    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Auth email enqueued', { emailType, email: enmascararEmail(payload.data.email), run_id })

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // Handle CORS preflight for main endpoint
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Route to preview handler for /preview path
  if (url.pathname.endsWith('/preview')) {
    return handlePreview(req)
  }

  // Main webhook handler
  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('Webhook handler error:', error)
    // REF-04: reportar a Sentry y NO filtrar error.message al llamante (el
    // mensaje crudo también termina en los logs de plataforma de Supabase Auth).
    await captureEdgeException(error, { fn: 'auth-email-hook', status_code: 500 })
    return new Response(JSON.stringify({ error: 'auth_email_hook_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
