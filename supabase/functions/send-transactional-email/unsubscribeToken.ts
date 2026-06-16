import { createClient } from 'npm:@supabase/supabase-js@2'

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export type TokenResult =
  | { token: string }
  | { tokenError: string }
  | { suppressed: true }

/** Get an existing unused unsubscribe token for `email`, or create a new one. */
export async function getOrCreateUnsubscribeToken(
  supabase: ReturnType<typeof createClient>,
  normalizedEmail: string
): Promise<TokenResult> {
  const { data: existing, error: lookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (lookupError) {
    console.error('Token lookup failed', { error: lookupError, email: normalizedEmail })
    return { tokenError: 'Failed to look up unsubscribe token' }
  }

  if (existing && !existing.used_at) return { token: existing.token }

  if (existing?.used_at) {
    // Token used but email not in suppressed list — safety fallback
    console.warn('Unsubscribe token already used but email not suppressed', { email: normalizedEmail })
    return { suppressed: true }
  }

  // No token yet — upsert (handles concurrent races gracefully)
  const newToken = generateToken()
  const { error: upsertError } = await supabase
    .from('email_unsubscribe_tokens')
    .upsert(
      { token: newToken, email: normalizedEmail },
      { onConflict: 'email', ignoreDuplicates: true }
    )

  if (upsertError) {
    console.error('Failed to create unsubscribe token', { error: upsertError })
    return { tokenError: 'Failed to create unsubscribe token' }
  }

  // Re-read to get the actual stored token (another request may have won the race)
  const { data: stored, error: reReadError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (reReadError || !stored) {
    console.error('Failed to read back unsubscribe token after upsert', {
      error: reReadError,
      email: normalizedEmail,
    })
    return { tokenError: 'Failed to confirm unsubscribe token storage' }
  }

  return { token: stored.token }
}
