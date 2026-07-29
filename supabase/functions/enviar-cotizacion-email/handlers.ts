import { createClient } from 'npm:@supabase/supabase-js@2';
import { captureEdgeException } from '../_shared/sentry.ts';
import { fetchOrgSlug } from '../_shared/orgSlug.ts';

const APP_URL = Deno.env.get('APP_PUBLIC_URL') ?? 'https://elogistix.lovable.app';
const SIGNED_URL_TTL = 60 * 60 * 24 * 30; // 30 días

import { isEmail } from './emailValidation.ts';
import { jsonResponse } from "../_shared/response.ts";
export { isEmail };

export async function handlePrepare(
  admin: ReturnType<typeof createClient>,
  pdfPath: string,
  cors: Record<string, string>,
): Promise<Response> {
  const { data: upload, error: upErr } = await admin
    .storage.from('cotizaciones-pdf')
    .createSignedUploadUrl(pdfPath);
  if (upErr || !upload) {
    return jsonResponse(cors, { error: 'No se pudo preparar la subida', detail: upErr?.message }, 500);
  }
  return jsonResponse(cors, { upload_url: upload.signedUrl, upload_token: upload.token, path: pdfPath });
}

interface Destinatario { email: string; nombre?: string }
interface Cotizacion {
  id: string; folio: string; organization_id: string; cliente_nombre: string;
  cliente_id?: string | null;
  origen: string; destino: string; incoterm: string; modo: string;
  fecha_vigencia: string | null; estado: string;
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
  const resultados: { email: string; tipo: string; ok: boolean; error?: string }[] = [];
  for (const r of recipients) {
    const idem = `cot-${cotId}-${timestamp}-${r.email}`;
    try {
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseServiceKey}` },
        body: JSON.stringify({
          templateName: 'cotizacion-enviada',
          recipientEmail: r.email,
          idempotencyKey: idem,
          templateData: { ...templateData, contacto: r.nombre },
        }),
      });
      const out = await resp.json().catch(() => ({}));
      const ok = resp.ok && (out?.success !== false || out?.queued === true);
      resultados.push({ email: r.email, tipo: r.tipo, ok, error: ok ? undefined : (out?.error ?? `HTTP ${resp.status}`) });
    } catch (e) {
      // 13.114.20: antes los fallos de red por destinatario quedaban sólo en
      // `resultados` (visibles para el caller pero no para ops). Capturamos
      // por iteración con índice + tipo (to/cc), sin el email (PII).
      await captureEdgeException(e, {
        fn: 'enviar-cotizacion-email',
        extra: { phase: 'send_recipient', recipient_index: resultados.length, recipient_type: r.tipo, cot_id: cotId },
      });
      resultados.push({ email: r.email, tipo: r.tipo, ok: false, error: (e as Error).message });
    }
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

interface SendBodyParsed {
  destinatarios: Destinatario[];
  validRecipients: Destinatario[];
  ccEmails: string[];
  mensaje: string;
  asunto: string;
  pdfStoragePath: string;
  marcarEnviada: boolean;
  totales: { mxn?: string; usd?: string };
  ejecutivo: { nombre?: string; email?: string; telefono?: string };
}

function parseSendBody(body: Record<string, unknown>): SendBodyParsed {
  const destinatarios = Array.isArray(body.destinatarios) ? (body.destinatarios as Destinatario[]) : [];
  const ccEmails = Array.isArray(body.cc) ? (body.cc as string[]).filter(isEmail) : [];
  return {
    destinatarios,
    validRecipients: destinatarios.filter((d) => d?.email && isEmail(d.email)),
    ccEmails,
    mensaje: typeof body.mensaje === 'string' ? body.mensaje : '',
    asunto: typeof body.asunto === 'string' ? body.asunto : '',
    pdfStoragePath: typeof body.pdf_path === 'string' ? body.pdf_path : '',
    marcarEnviada: body.marcar_enviada !== false,
    totales: (body.totales ?? {}) as { mxn?: string; usd?: string },
    ejecutivo: (body.ejecutivo ?? {}) as { nombre?: string; email?: string; telefono?: string },
  };
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

function buildTemplateData(cot: Cotizacion, parsed: SendBodyParsed, pdfLink: string, enlacePortal: string) {
  return {
    folio: cot.folio, cliente: cot.cliente_nombre, origen: cot.origen, destino: cot.destino,
    incoterm: cot.incoterm, modo: cot.modo, vigencia: cot.fecha_vigencia ?? undefined,
    totalMxn: parsed.totales.mxn, totalUsd: parsed.totales.usd,
    mensaje: parsed.mensaje, enlacePortal, enlacePdf: pdfLink,
    ejecutivoNombre: parsed.ejecutivo.nombre,
    ejecutivoEmail: parsed.ejecutivo.email,
    ejecutivoTelefono: parsed.ejecutivo.telefono,
  };
}

export async function handleSend(params: SendParams): Promise<Response> {
  const { admin, supabaseUrl, supabaseServiceKey, cot, userId, userEmail, body, timestamp, cors } = params;

  const parsed = parseSendBody(body);
  if (parsed.validRecipients.length === 0) return jsonResponse(cors, { error: 'Al menos un destinatario válido es requerido' }, 400);
  if (!parsed.pdfStoragePath) return jsonResponse(cors, { error: 'pdf_path requerido (sube el PDF primero con action=prepare)' }, 400);

  // M8: los destinatarios deben pertenecer al cliente de la cotización.
  if (cot.cliente_id) {
    const permitidos = await emailsPermitidosCliente(admin as never, cot.cliente_id);
    const ajenos = [...parsed.validRecipients.map((d) => d.email), ...parsed.ccEmails]
      .filter((e) => !permitidos.has(e.trim().toLowerCase()));
    if (ajenos.length > 0) {
      return jsonResponse(cors, {
        error: 'Uno o más correos no pertenecen a los contactos del cliente',
        code: DESTINATARIO_NO_PERMITIDO,
      }, 400);
    }
  }


  const safeFolio = (cot.folio ?? 'cotizacion').replace(/[^A-Za-z0-9._-]+/g, '_');
  const orgSlug = await fetchOrgSlug(admin, cot.organization_id);
  const { data: signed, error: signErr } = await admin
    .storage.from('cotizaciones-pdf')
    .createSignedUrl(parsed.pdfStoragePath, SIGNED_URL_TTL, {
      download: `${orgSlug}_Cotizacion-${safeFolio}.pdf`,
    });
  if (signErr || !signed) return jsonResponse(cors, { error: 'No se pudo generar link al PDF', detail: signErr?.message }, 500);

  const pdfLink = signed.signedUrl;
  const enlacePortal = `${APP_URL}/cotizaciones/${cot.id}`;
  const templateData = buildTemplateData(cot, parsed, pdfLink, enlacePortal);

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

  return jsonResponse(cors, { success: anyOk, estado: estadoEnvio, envio_id: envioId, resultados, pdf_link: pdfLink });
}
