/**
 * Endpoint `/preview`: renderiza una plantilla de correo con datos de muestra,
 * sin enviar nada. Sólo accesible con la LOVABLE_API_KEY del proyecto.
 */
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { EMAIL_TEMPLATES, SITE_NAME } from './templates.ts'

// Datos de muestra usados SÓLO en preview (nunca en envíos reales).
// El correo de muestra usa un placeholder fijo (TLD .test, RFC 6761) para que
// el backend pueda reemplazarlo por el destinatario real en pruebas.
const SAMPLE_PROJECT_URL = 'https://elogistix.lovable.app'
const SAMPLE_EMAIL = 'user@example.test'

const SAMPLE_DATA: Record<string, Record<string, unknown>> = {
  signup: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    recipient: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  magiclink: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  recovery: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  invite: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  email_change: {
    siteName: SITE_NAME,
    oldEmail: SAMPLE_EMAIL,
    email: SAMPLE_EMAIL,
    newEmail: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  reauthentication: {
    token: '123456',
  },
}

const previewCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
}

function previewJson(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
  })
}

export async function handlePreview(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: previewCorsHeaders })
  }

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const authHeader = req.headers.get('Authorization')
  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return previewJson({ error: 'Unauthorized' }, 401)
  }

  let type: string
  try {
    const body = await req.json()
    type = body.type
  } catch {
    return previewJson({ error: 'Invalid JSON in request body' }, 400)
  }

  const EmailTemplate = EMAIL_TEMPLATES[type]
  if (!EmailTemplate) {
    return previewJson({ error: `Unknown email type: ${type}` }, 400)
  }

  const html = await renderAsync(React.createElement(EmailTemplate, SAMPLE_DATA[type] ?? {}))
  return new Response(html, {
    status: 200,
    headers: { ...previewCorsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}
