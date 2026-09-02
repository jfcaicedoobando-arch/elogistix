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

/**
 * Ronda YAGNI · defecto 10 — el rebote/queja/baja actualiza el envío ORIGINAL
 * (correlación por `message_id` del proveedor). `event_id` sólo sirve para
 * trazas y como respaldo cuando el evento no trae `message_id`.
 */
async function registrarResultado(
  recipient: string,
  razon: RazonSupresion,
  eventId: string,
  providerMessageId?: string,
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

  // Upsert por message_id: si el envío original existe queda en 'bounced' /
  // 'complained' / 'suppressed'; si no llegó a registrarse se crea la fila.
  const { error: bitacoraError } = await admin.rpc('email_send_log_touch', {
    p_message_id: providerMessageId || eventId,
    p_template: 'system',
    p_recipient: email,
    p_status: ESTADO_BITACORA[razon],
    p_error: MENSAJE_BITACORA[razon],
  })
  if (bitacoraError) {
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
      await registrarResultado(event.data.recipient, 'bounce', event.event_id, event.data.message_id)
    },
    'email.complaint': async (event) => {
      await registrarResultado(event.data.recipient, 'complaint', event.event_id, event.data.message_id)
    },
    'email.unsubscribed': async (event) => {
      await registrarResultado(event.data.recipient, 'unsubscribe', event.event_id, event.data.message_id)
    },
  },
})

Deno.serve((req) => handler(req))
