import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import { wrapEdgeHandler } from "../_shared/sentry.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { extractToken } from './tokenExtractor.ts'
import { maskEmail } from '../_shared/redact.ts'

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(wrapEdgeHandler("handle-email-unsubscribe", async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  const token = await extractToken(req)
  if (!token) return jsonResponse({ error: 'Token is required' }, 400)

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: tokenRecord, error: lookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('*')
    .eq('token', token)
    .maybeSingle()

  if (lookupError || !tokenRecord) return jsonResponse({ error: 'Invalid or expired token' }, 404)
  if (tokenRecord.used_at) return jsonResponse({ valid: false, reason: 'already_unsubscribed' })
  if (req.method === 'GET') return jsonResponse({ valid: true })

  // POST: atomic check-and-update to avoid TOCTOU race
  const { data: updated, error: updateError } = await supabase
    .from('email_unsubscribe_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token', token)
    .is('used_at', null)
    .select()
    .maybeSingle()

  if (updateError) {
    // EF-13: nunca loguear el token completo — es reutilizable hasta que se marca usado.
    console.error('Failed to mark token as used', { error: updateError, token_prefix: token.slice(0, 8) })
    return jsonResponse({ error: 'Failed to process unsubscribe' }, 500)
  }
  if (!updated) return jsonResponse({ success: false, reason: 'already_unsubscribed' })

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      { email: tokenRecord.email.toLowerCase(), reason: 'unsubscribe' },
      { onConflict: 'email' }
    )

  if (suppressError) {
    console.error('Failed to suppress email', { error: suppressError, email: maskEmail(tokenRecord.email) })
    return jsonResponse({ error: 'Failed to process unsubscribe' }, 500)
  }

  console.log('Email unsubscribed', { email: maskEmail(tokenRecord.email) })
  return jsonResponse({ success: true })
}))
