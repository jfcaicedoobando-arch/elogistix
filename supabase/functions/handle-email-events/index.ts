import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

// Receptor de eventos terminales de entrega (rebote, queja, baja). Sólo
// registra el resultado en las tablas de bitácora de la app: la supresión real
// la aplica Lovable del lado servidor antes de cada envío.
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

type RazonSupresion = 'bounce' | 'complaint' | 'unsubscribe'

const ESTADO_BITACORA: Record<RazonSupresion, 'bounced' | 'complained' | 'suppressed'> = {
  bounce: 'bounced',
  complaint: 'complained',
  unsubscribe: 'suppressed',
}

const MENSAJE_BITACORA: Record<RazonSupresion, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

async function registrarResultado(
  recipient: string,
  razon: RazonSupresion,
  eventId: string,
): Promise<void> {
  const email = recipient.toLowerCase()

  // Idempotente: upsert por email, seguro ante reentregas del webhook.
  const { error: supresionError } = await admin
    .from('suppressed_emails')
    .upsert({ email, reason: razon, metadata: null }, { onConflict: 'email' })
  if (supresionError) {
    console.error('No se pudo registrar la supresión', {
      event_id: eventId,
      code: supresionError.code,
      message: supresionError.message,
    })
    throw new Error('suppressed_emails write failed')
  }

  const { error: bitacoraError } = await admin.from('email_send_log').insert({
    message_id: eventId,
    template_name: 'system',
    recipient_email: email,
    status: ESTADO_BITACORA[razon],
    error_message: MENSAJE_BITACORA[razon],
    metadata: null,
  })
  if (bitacoraError && bitacoraError.code !== '23505') {
    console.error('No se pudo registrar el evento en la bitácora', {
      event_id: eventId,
      code: bitacoraError.code,
      message: bitacoraError.message,
    })
    throw new Error('email_send_log write failed')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await registrarResultado(event.data.recipient, 'bounce', event.event_id)
    },
    'email.complaint': async (event) => {
      await registrarResultado(event.data.recipient, 'complaint', event.event_id)
    },
    'email.unsubscribed': async (event) => {
      await registrarResultado(event.data.recipient, 'unsubscribe', event.event_id)
    },
  },
})

Deno.serve((req) => handler(req))
