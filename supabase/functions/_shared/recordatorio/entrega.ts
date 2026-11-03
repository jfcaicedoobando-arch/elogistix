import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { enviarEmailPlantilla } from '../enviarEmailPlantilla.ts';
import type { TemplateData } from './factura.ts';

// Conserva la clave por ventana existente; el transporte recibe esa clave.
// No afirma atomicidad con DB ni entrega garantizada por una cola.
export const VENTANA_IDEMPOTENCIA_MS = 10 * 60 * 1000;

export function messageIdRecordatorio(facturaId: string, canal: string, now: number = Date.now()): string {
  const ventana = Math.floor(now / VENTANA_IDEMPOTENCIA_MS);
  return `recordatorio-${facturaId}-${canal}-${ventana}`;
}

export async function sendRecordatorio(
  supabaseUrl: string,
  serviceRoleKey: string,
  destinatario: string,
  templateData: TemplateData,
  messageId: string,
): Promise<void> {
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const envio = await enviarEmailPlantilla(admin, {
    templateName: 'recordatorio-cobranza',
    recipientEmail: destinatario,
    messageId,
    idempotencyKey: messageId,
    templateData: templateData as unknown as Record<string, unknown>,
  });
  if (!envio.ok) {
    throw new Error(`Error al enviar correo: ${envio.error ?? 'desconocido'}`);
  }
}
