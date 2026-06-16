/**
 * Extracts the unsubscribe token from GET query params, POST form body
 * (RFC 8058 one-click), or POST JSON body.
 */
export async function extractToken(req: Request): Promise<string | null> {
  const url = new URL(req.url)
  const queryToken = url.searchParams.get('token')
  if (req.method !== 'POST') return queryToken

  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const formText = await req.text()
    const params = new URLSearchParams(formText)
    // RFC 8058 one-click: token comes from query param; form body has List-Unsubscribe field
    if (params.get('List-Unsubscribe')) return queryToken
    return params.get('token') ?? queryToken
  }

  try {
    const body = await req.json()
    if (body.token) return body.token as string
  } catch {
    // Fall through — token stays from query param
  }
  return queryToken
}
