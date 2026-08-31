/**
 * Adaptador de envío de correos de aplicación sobre la entrega administrada de
 * Lovable. Sustituye la llamada HTTP a la función `send-transactional-email`
 * (cola pgmq) por un envío sincrónico a través del helper `sendTemplateEmail`,
 * conservando la bitácora en `email_send_log`:
 *
 *  - envío exitoso            → 'sent'
 *  - destinatario suprimido   → 'suppressed'
 *  - cualquier otro fallo     → 'failed' con el mensaje de error
 *
 * La supresión, los reintentos, el rate limit y la baja de suscripción los
 * aplica Lovable del lado servidor: aquí nunca se consulta ni se escribe una
 * tabla de supresión.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendTemplateEmail } from "./transactional-email-templates/send-email.ts";
import { registrarEstadoEmail } from "./emailSendLog.ts";

export interface EnvioPlantillaArgs {
  templateName: string;
  recipientEmail: string;
  templateData?: Record<string, unknown>;
  idempotencyKey?: string;
  /** Se usa como clave de bitácora; si no se envía se genera un UUID. */
  messageId?: string;
}

export interface EnvioPlantillaResultado {
  ok: boolean;
  suprimido: boolean;
  error?: string;
}

export async function enviarEmailPlantilla(
  supabase: SupabaseClient,
  args: EnvioPlantillaArgs,
): Promise<EnvioPlantillaResultado> {
  const messageId = args.messageId ?? crypto.randomUUID();
  const base = {
    messageId,
    templateName: args.templateName,
    recipientEmail: args.recipientEmail,
  };

  try {
    const resultado = await sendTemplateEmail(args.templateName, args.recipientEmail, {
      templateData: args.templateData ?? {},
      idempotencyKey: args.idempotencyKey ?? messageId,
    });

    if (!resultado.sent) {
      await registrarEstadoEmail(supabase, {
        ...base,
        status: "suppressed",
        errorMessage: "Destinatario suprimido (rebote, queja o baja previa)",
      });
      return { ok: false, suprimido: true, error: "Destinatario suprimido" };
    }

    await registrarEstadoEmail(supabase, { ...base, status: "sent" });
    return { ok: true, suprimido: false };
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error);
    await registrarEstadoEmail(supabase, {
      ...base,
      status: "failed",
      errorMessage: mensaje.slice(0, 1000),
    });
    return { ok: false, suprimido: false, error: mensaje };
  }
}
