import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const APP_URL = Deno.env.get('APP_PUBLIC_URL') ?? 'https://elogistix.lovable.app';
const SIGNED_URL_TTL = 60 * 60 * 24 * 30; // 30 días

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export { isEmail };

export async function handlePrepare(
  admin: ReturnType<typeof createClient>,
  pdfPath: string
): Promise<Response> {
  const { data: upload, error: upErr } = await admin
    .storage.from('cotizaciones-pdf')
    .createSignedUploadUrl(pdfPath);
  if (upErr || !upload) {
    return json({ error: 'No se pudo preparar la subida', detail: upErr?.message }, 500);
  }
  return json({ upload_url: upload.signedUrl, upload_token: upload.token, path: pdfPath });
}

interface Destinatario { email: string; nombre?: string }
interface Cotizacion {
  id: string; folio: string; organization_id: string; cliente_nombre: string;
  origen: string; destino: string; incoterm: string; modo: string;
  fecha_vigencia: string | null; estado: string;
}

async function sendEmailsToRecipients(
  supabaseUrl: string,
  supabaseServiceKey: string,
  allRecipients: { email: string; nombre?: string; tipo: 'to' | 'cc' }[],
  templateData: Record<string, unknown>,
  cotId: string,
  timestamp: number
): Promise<{ email: string; tipo: string; ok: boolean; error?: string }[]> {
  const resultados: { email: string; tipo: string; ok: boolean; error?: string }[] = [];
  for (const r of allRecipients) {
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
}

export async function handleSend(params: SendParams): Promise<Response> {
  const { admin, supabaseUrl, supabaseServiceKey, cot, userId, userEmail, body, timestamp } = params;

  const destinatarios = Array.isArray(body.destinatarios) ? (body.destinatarios as Destinatario[]) : [];
  const ccEmails = Array.isArray(body.cc) ? (body.cc as string[]).filter(isEmail) : [];
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje : '';
  const asunto = typeof body.asunto === 'string' ? body.asunto : '';
  const pdfStoragePath = typeof body.pdf_path === 'string' ? body.pdf_path : '';
  const marcarEnviada = body.marcar_enviada !== false;
  const totales = (body.totales ?? {}) as { mxn?: string; usd?: string };
  const ejecutivo = (body.ejecutivo ?? {}) as { nombre?: string; email?: string; telefono?: string };

  const validRecipients = destinatarios.filter((d) => d?.email && isEmail(d.email));
  if (validRecipients.length === 0) return json({ error: 'Al menos un destinatario válido es requerido' }, 400);
  if (!pdfStoragePath) return json({ error: 'pdf_path requerido (sube el PDF primero con action=prepare)' }, 400);

  const { data: signed, error: signErr } = await admin
    .storage.from('cotizaciones-pdf')
    .createSignedUrl(pdfStoragePath, SIGNED_URL_TTL);
  if (signErr || !signed) return json({ error: 'No se pudo generar link al PDF', detail: signErr?.message }, 500);

  const pdfLink = signed.signedUrl;
  const enlacePortal = `${APP_URL}/cotizaciones/${cot.id}`;
  const templateData = {
    folio: cot.folio, cliente: cot.cliente_nombre, origen: cot.origen, destino: cot.destino,
    incoterm: cot.incoterm, modo: cot.modo, vigencia: cot.fecha_vigencia ?? undefined,
    totalMxn: totales.mxn, totalUsd: totales.usd, mensaje, enlacePortal, enlacePdf: pdfLink,
    ejecutivoNombre: ejecutivo.nombre, ejecutivoEmail: ejecutivo.email, ejecutivoTelefono: ejecutivo.telefono,
  };

  const allRecipients = [
    ...validRecipients.map((d) => ({ email: d.email, nombre: d.nombre, tipo: 'to' as const })),
    ...ccEmails.map((e) => ({ email: e, tipo: 'cc' as const })),
  ];

  const resultados = await sendEmailsToRecipients(supabaseUrl, supabaseServiceKey, allRecipients, templateData, cot.id, timestamp);
  const anyOk = resultados.some((r) => r.ok);
  const anyFail = resultados.some((r) => !r.ok);
  const estadoEnvio = buildEstadoEnvio(anyOk, anyFail);

  const { data: envio, error: envioErr } = await admin
    .from('cotizacion_envios')
    .insert({
      cotizacion_id: cot.id, organization_id: cot.organization_id, enviado_por: userId,
      destinatarios: validRecipients, cc: ccEmails, asunto, mensaje,
      pdf_storage_path: pdfStoragePath, pdf_link_publico: pdfLink, estado: estadoEnvio,
      error: anyFail ? JSON.stringify(resultados.filter((r) => !r.ok)) : null,
    })
    .select('id').single();

  if (envioErr) console.error('Failed to insert cotizacion_envios', envioErr);

  await admin.from('bitacora_actividad').insert({
    organization_id: cot.organization_id, usuario_id: userId, usuario_email: userEmail,
    modulo: 'cotizaciones',
    accion: anyOk ? 'cotizacion_enviada_email' : 'cotizacion_envio_email_fallido',
    entidad_id: cot.id, entidad_nombre: cot.folio,
    detalles: { envio_id: envio?.id ?? null, destinatarios: validRecipients.map((d) => d.email), cc: ccEmails, resultados },
  }).then(() => null, () => null);

  await updateCotizacionEstado(admin, cot, anyOk, marcarEnviada);

  return json({ success: anyOk, estado: estadoEnvio, envio_id: envio?.id ?? null, resultados, pdf_link: pdfLink });
}
