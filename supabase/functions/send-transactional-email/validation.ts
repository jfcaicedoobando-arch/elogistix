import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

export interface ParsedRequest {
  templateName: string
  recipientEmail: string
  messageId: string
  idempotencyKey: string
  templateData: Record<string, unknown>
}

export function corsResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export async function parseRequest(req: Request): Promise<ParsedRequest | Response> {
  let templateName: string
  let recipientEmail: string
  let idempotencyKey: string
  let messageId: string
  let templateData: Record<string, unknown> = {}

  try {
    const body = await req.json()
    templateName = body.templateName || body.template_name
    recipientEmail = body.recipientEmail || body.recipient_email
    messageId = crypto.randomUUID()
    idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return corsResponse({ error: 'Invalid JSON in request body' }, 400)
  }

  if (!templateName) {
    return corsResponse({ error: 'templateName is required' }, 400)
  }

  return { templateName, recipientEmail, messageId, idempotencyKey, templateData }
}
