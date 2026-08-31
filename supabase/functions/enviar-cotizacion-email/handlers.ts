import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { captureEdgeException } from '../_shared/sentry.ts';
import { fetchOrgSlug } from '../_shared/orgSlug.ts';
import { DESTINATARIO_NO_PERMITIDO, emailsPermitidosCliente } from '../_shared/destinatarioCliente.ts';
import { authorizeOrgRole, ROLES_ESCRITURA_COTIZACIONES } from '../_shared/auth.ts';


const APP_URL = Deno.env.get('APP_PUBLIC_URL') ?? 'https://elogistix.lovable.app';
// W-03 (auditoría R2): el link firmado viaja en el correo y queda persistido en
// `cotizacion_envios.pdf_link_publico`. 30 días exponían el PDF (precios,
// condiciones) ante cualquier filtración del historial de correo. 7 días
// alcanzan para que el cliente lo abra; si expira, se reenvía la cotización.
export const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 días

import {
  BUCKET_PDF, buildTemplateData, parseSendBody, resolverEjecutivo, resolverPdfPath,
  type Cotizacion, type Destinatario, type SendBodyParsed,
} from './sendHelpers.ts';


import { isEmail } from './emailValidation.ts';
import { jsonResponse } from "../_shared/response.ts";
export { isEmail };

export async function handlePrepare(
  admin: ReturnType<typeof createClient>,
  pdfPath: string,
  cors: Record<string, string>,
): Promise<Response> {
  const { data: upload, error: upErr } = await admin
    .storage.from(BUCKET_PDF)
    .createSignedUploadUrl(pdfPath);
  if (upErr || !upload) {
    return jsonResponse({ error: 'No se pudo preparar la subida', detail: upErr?.message }, 500, cors);
  }
  return jsonResponse({ upload_url: upload.signedUrl, upload_token: upload.token, path: pdfPath }, 200, cors);
}






interface SendBatchParams {
  supabaseUrl: string;
  supabaseServiceKey: string;
  recipients: { email: string; nombre?: string; tipo: 'to' | 'cc' }[];
  templateData: Record<string, unknown>;
  cotId: string;
  timestamp: number;
}

async function sendEmailsToRecipients(
  params: SendBatchParams,
): Promise<{ email: string; tipo: string; ok: boolean; error?: string }[]> {
  const { supabaseUrl, supabaseServiceKey, recipients, templateData, cotId, timestamp } = params;
  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const resultados: { email: string; tipo: string; ok: boolean; error?: string }[] = [];
  for (const r of recipients) {
    const idem = `cot-${cotId}-${timestamp}-${r.email}`;
    const envio = await enviarEmailPlantilla(admin, {
      templateName: 'cotizacion-enviada',
      recipientEmail: r.email,
      idempotencyKey: idem,
      templateData: { ...templateData, contacto: r.nombre },
    });
    if (!envio.ok && !envio.suprimido) {
      // 13.114.20: los fallos por destinatario también van a Sentry, con índice
      // y tipo (to/cc), sin el email (PII).
      await captureEdgeException(new Error(envio.error ?? 'Error al enviar correo'), {
        fn: 'enviar-cotizacion-email',
        extra: { phase: 'send_recipient', recipient_index: resultados.length, recipient_type: r.tipo, cot_id: cotId },
      });
    }
    resultados.push({ email: r.email, tipo: r.tipo, ok: envio.ok, error: envio.ok ? undefined : envio.error });
  }
  return resultados;
}

function buildEstadoEnvio(anyOk: boolean, anyFail: boolean): string {
  if (anyOk && anyFail) return 'parcial';
  return anyOk ? 'enviado' : 'fallido';
}

async function updateCotizacionEstado(
  admin: ReturnType<typeof createClient>,
  cot: Cotizacion,
  anyOk: boolean,
  marcarEnviada: boolean
): Promise<void> {
  if (!anyOk) return;
  if (marcarEnviada && cot.estado === 'Borrador') {
    await admin.from('cotizaciones')
      .update({ estado: 'Enviada', fecha_envio: new Date().toISOString() })
      .eq('id', cot.id);
  } else if (cot.estado === 'Borrador') {
    await admin.from('cotizaciones')
      .update({ fecha_envio: new Date().toISOString() })
      .eq('id', cot.id)
      .is('fecha_envio', null);
  }
}

export interface SendParams {
  admin: ReturnType<typeof createClient>;
  supabaseUrl: string;
  supabaseServiceKey: string;
  cot: Cotizacion;
  userId: string;
  userEmail: string;
  body: Record<string, unknown>;
  timestamp: number;
  cors: Record<string, string>;
}




interface PersistParams {
  admin: ReturnType<typeof createClient>;
  cot: Cotizacion;
  userId: string;
  userEmail: string;
  parsed: SendBodyParsed;
  pdfLink: string;
  resultados: { email: string; tipo: string; ok: boolean; error?: string }[];
  estadoEnvio: string;
  anyOk: boolean;
  anyFail: boolean;
}

async function persistEnvioAndLog(params: PersistParams): Promise<string | null> {
  const { admin, cot, userId, userEmail, parsed, pdfLink, resultados, estadoEnvio, anyOk, anyFail } = params;
  const { data: envio, error: envioErr } = await admin
    .from('cotizacion_envios')
    .insert({
      cotizacion_id: cot.id, organization_id: cot.organization_id, enviado_por: userId,
      destinatarios: parsed.validRecipients, cc: parsed.ccEmails, asunto: parsed.asunto, mensaje: parsed.mensaje,
      // W-03: `pdf_link_publico` es un link TEMPORAL firmado (TTL 7 días).
      pdf_storage_path: parsed.pdfStoragePath, pdf_link_publico: pdfLink, estado: estadoEnvio,
      error: anyFail ? JSON.stringify(resultados.filter((r) => !r.ok)) : null,
    })
    .select('id').single();

  if (envioErr) console.error('Failed to insert cotizacion_envios', envioErr);

  await admin.from('bitacora_actividad').insert({
    organization_id: cot.organization_id, usuario_id: userId, usuario_email: userEmail,
    modulo: 'cotizaciones',
    accion: anyOk ? 'cotizacion_enviada_email' : 'cotizacion_envio_email_fallido',
    entidad_id: cot.id, entidad_nombre: cot.folio,
    detalles: { envio_id: envio?.id ?? null, destinatarios: parsed.validRecipients.map((d) => d.email), cc: parsed.ccEmails, resultados },
  }).then(() => null, () => null);

  return envio?.id ?? null;
}




/**
 * Validaciones previas al envío: rol de escritura (W-05) y destinatarios que
 * pertenezcan a los contactos del cliente (M8). Devuelve la Response de
 * rechazo o `null` si puede continuar.
 */
async function validarEnvio(
  admin: ReturnType<typeof createClient>,
  cot: Cotizacion,
  userId: string,
  parsed: SendBodyParsed,
  cors: Record<string, string>,
): Promise<Response | null> {
  if (parsed.validRecipients.length === 0) {
    return jsonResponse({ error: 'Al menos un destinatario válido es requerido' }, 400, cors);
  }
  // W-05 (auditoría R2): antes bastaba ser miembro de la org (incluido
  // `viewer`) para enviar cotizaciones al cliente en nombre de la empresa.
  const okRol = await authorizeOrgRole(admin, userId, cot.organization_id, ROLES_ESCRITURA_COTIZACIONES);
  if (!okRol) {
    return jsonResponse({ error: 'Tu rol no puede enviar cotizaciones' }, 403, cors);
  }
  if (!cot.cliente_id) return null;
  const permitidos = await emailsPermitidosCliente(admin as never, cot.cliente_id);
  const ajenos = [...parsed.validRecipients.map((d) => d.email), ...parsed.ccEmails]
    .filter((e) => !permitidos.has(e.trim().toLowerCase()));
  if (ajenos.length > 0) {
    return jsonResponse({
      error: 'Uno o más correos no pertenecen a los contactos del cliente',
      code: DESTINATARIO_NO_PERMITIDO,
    }, 400, cors);
  }
  return null;
}

export async function handleSend(params: SendParams): Promise<Response> {
  const { admin, supabaseUrl, supabaseServiceKey, cot, userId, userEmail, body, timestamp, cors } = params;

  const parsed = parseSendBody(body);
  const rechazo = await validarEnvio(admin, cot, userId, parsed, cors);
  if (rechazo) return rechazo;

  const pdfPath = await resolverPdfPath(admin, cot);
  if (!pdfPath) {
    return jsonResponse({ error: 'No hay PDF para esta cotización (súbelo primero con action=prepare)' }, 400, cors);
  }
  parsed.pdfStoragePath = pdfPath;
  parsed.ejecutivo = await resolverEjecutivo(admin, userId, userEmail);

  const safeFolio = (cot.folio ?? 'cotizacion').replace(/[^A-Za-z0-9._-]+/g, '_');
  const orgSlug = await fetchOrgSlug(admin, cot.organization_id);
  const { data: signed, error: signErr } = await admin
    .storage.from(BUCKET_PDF)
    .createSignedUrl(pdfPath, SIGNED_URL_TTL, {
      download: `${orgSlug}_Cotizacion-${safeFolio}.pdf`,
    });
  if (signErr || !signed) {
    return jsonResponse({ error: 'No se pudo generar link al PDF', detail: signErr?.message }, 500, cors);
  }

  const pdfLink = signed.signedUrl;
  const pdfLinkExpiraEn = new Date(Date.now() + SIGNED_URL_TTL * 1000).toISOString();
  const templateData = buildTemplateData(cot, parsed, pdfLink, `${APP_URL}/cotizaciones/${cot.id}`);

  const recipients = [
    ...parsed.validRecipients.map((d) => ({ email: d.email, nombre: d.nombre, tipo: 'to' as const })),
    ...parsed.ccEmails.map((e) => ({ email: e, tipo: 'cc' as const })),
  ];

  const resultados = await sendEmailsToRecipients({
    supabaseUrl, supabaseServiceKey, recipients, templateData, cotId: cot.id, timestamp,
  });
  const anyOk = resultados.some((r) => r.ok);
  const anyFail = resultados.some((r) => !r.ok);
  const estadoEnvio = buildEstadoEnvio(anyOk, anyFail);

  const envioId = await persistEnvioAndLog({
    admin, cot, userId, userEmail, parsed, pdfLink, resultados, estadoEnvio, anyOk, anyFail,
  });

  await updateCotizacionEstado(admin, cot, anyOk, parsed.marcarEnviada);

  return jsonResponse({
    success: anyOk, estado: estadoEnvio, envio_id: envioId, resultados,
    pdf_link: pdfLink, pdf_link_expires_at: pdfLinkExpiraEn,
  }, 200, cors);
}

