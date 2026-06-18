import { createClient } from 'npm:@supabase/supabase-js@2'
import { wrapEdgeHandler } from "../_shared/sentry.ts"
import { WebhookError, verifyWebhookRequest } from 'npm:@lovable.dev/webhooks-js'
import {
  parseSuppressionPayload,
  mapReasonToStatus,
  mapReasonToMessage,
  redactEmail,
  type SuppressionPayload,
} from './helpers.ts'

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(wrapEdgeHandler("handle-email-suppression", async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  // Verify HMAC signature using the Lovable API Key (same as auth-email-hook)
  let payload: SuppressionPayload
  try {
    const verified = await verifyWebhookRequest({
      req,
      secret: apiKey,
      parser: parseSuppressionPayload,
    })
    payload = verified.payload
  } catch (error) {
    if (error instanceof WebhookError) {
      switch (error.code) {
        case 'invalid_signature':
          console.error('Invalid webhook signature')
          return jsonResponse({ error: 'Invalid signature' }, 401)
        case 'stale_timestamp':
          console.error('Stale webhook timestamp')
          return jsonResponse({ error: 'Stale timestamp' }, 401)
        case 'invalid_payload':
        case 'invalid_json':
          console.error('Invalid payload', { code: error.code })
          return jsonResponse({ error: 'Invalid payload' }, 400)
        default:
          console.error('Webhook verification failed', {
            code: error.code,
            message: error.message,
          })
          return jsonResponse({ error: 'Verification failed' }, 401)
      }
    }
    console.error('Unexpected error during verification', { error })
    return jsonResponse({ error: 'Internal error' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const normalizedEmail = payload.email.toLowerCase()

  // 1. Upsert to suppressed_emails (idempotent — safe for retries)
  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      {
        email: normalizedEmail,
        reason: payload.reason,
        metadata: payload.metadata ?? null,
      },
      { onConflict: 'email' },
    )

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      error: suppressError,
      email_redacted: redactEmail(normalizedEmail),
    })
    return jsonResponse({ error: 'Failed to write suppression' }, 500)
  }

  // 2. Append a new log entry for the suppression event (never update existing rows)
  const sendLogStatus = mapReasonToStatus(payload.reason)
  const sendLogMessage = mapReasonToMessage(payload.reason)

  const { error: insertError } = await supabase
    .from('email_send_log')
    .insert({
      message_id: payload.message_id ?? null,
      template_name: 'system',
      recipient_email: normalizedEmail,
      status: sendLogStatus,
      error_message: sendLogMessage,
      metadata: payload.metadata ?? null,
    })

  if (insertError) {
    // Non-fatal — log and continue. The suppression was already recorded.
    console.warn('Failed to insert email_send_log', { error: insertError })
  }

  console.log('Suppression processed', {
    email_redacted: redactEmail(normalizedEmail),
    reason: payload.reason,
    is_retry: payload.is_retry,
    retry_count: payload.retry_count,
    has_message_id: !!payload.message_id,
  })

  return jsonResponse({ success: true })
}))
