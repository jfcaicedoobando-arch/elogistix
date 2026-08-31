/**
 * Helpers para `enviar-factura-email`. Extraído del handler principal para
 * respetar el límite `max-lines` del linter y facilitar tests unitarios.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { captureEdgeException } from "../_shared/sentry.ts";
import { enviarEmailPlantilla } from "../_shared/enviarEmailPlantilla.ts";
import { jsonResponse as _jsonResponse } from "../_shared/response.ts";
import { FACTURAPI_BASE, basicAuthHeader } from '../_shared/facturapiAuth.ts';
import { fetchOrgSlug } from '../_shared/orgSlug.ts';
import { buildFilename } from '../_shared/facturaFilename.ts';

// R2 seguridad · P1 (B-5): 7 días en lugar de 30. Son URLs firmadas que dan
// acceso al CFDI sin autenticación; viven dentro del correo enviado al cliente
// y ya NO se devuelven en la respuesta HTTP de la función.
export const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 días
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Alias local con firma (cors, data, status) para conservar callsites de este handler.
export const json = (cors: Record<string, string>, data: Record<string, unknown>, status = 200): Response =>
  _jsonResponse(data, status, cors);

export interface Destinatario { email: string; nombre?: string }

export interface FacturaCtx {
  id: string;
  numero: string;
  organization_id: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  total: number | null;
  moneda: string | null;
  uuid_fiscal: string | null;
  folio_fiscal: string | null;
  serie: string | null;
  metodo_pago: string | null;
  forma_pago: string | null;
  fecha_emision: string | null;
  facturapi_id: string | null;
}

export interface SendParsed {
  destinatarios: Destinatario[];
  validRecipients: Destinatario[];
  ccEmails: string[];
  mensaje: string;
  asunto: string;
  totalFormateado?: string;
  ejecutivo: { nombre?: string; email?: string; telefono?: string };
}

export async function loadFactura(admin: ReturnType<typeof createClient>, id: string, userId: string) {
  const { data, error } = await admin
    .from('facturas')
    .select('id, numero, organization_id, cliente_id, cliente_nombre, total, moneda, uuid_fiscal, folio_fiscal, serie, metodo_pago, forma_pago, fecha_emision, facturapi_id')
    .eq('id', id)
    // RTC-01: sin genérico el cliente sin tipos infiere `never`.
    .maybeSingle<FacturaCtx>();
  if (error || !data) return { err: 'Factura no encontrada', status: 404 };
  if (!data.facturapi_id || !data.uuid_fiscal) {
    return { err: 'La factura no está timbrada aún', status: 400 };
  }
  const { data: membership } = await admin
    .from('organization_members')
    .select('id')
    .eq('organization_id', data.organization_id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!membership) return { err: 'No tienes acceso a esta factura', status: 403 };
  return { factura: data };
}

export async function fetchFacturapiFile(apiKey: string, facturapiId: string, tipo: 'pdf' | 'xml'): Promise<Uint8Array> {
  const url = `${FACTURAPI_BASE}/invoices/${facturapiId}/${tipo}`;
  const res = await fetch(url, { headers: { Authorization: basicAuthHeader(apiKey) } });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`FacturApi ${tipo} ${res.status}: ${detail.slice(0, 200)}`) as Error & { status?: number; body?: string };
    err.status = res.status;
    err.body = detail;
    throw err;
  }
  const ab = await res.arrayBuffer();
  return new Uint8Array(ab);
}

/**
 * Descarga PDF/XML probando primero la key primaria (ambiente actual de la
 * org) y, si FacturApi responde 404 `invoice_not_found`, reintenta con la
 * key del ambiente opuesto. Cubre facturas históricas timbradas antes de
 * cambiar la org de sandbox a live (o viceversa).
 */
export async function fetchFacturapiFileWithFallback(
  primaryKey: string,
  fallbackKey: string | null,
  facturapiId: string,
  tipo: 'pdf' | 'xml',
): Promise<Uint8Array> {
  try {
    return await fetchFacturapiFile(primaryKey, facturapiId, tipo);
  } catch (e) {
    const err = e as Error & { status?: number; body?: string };
    const is404 = err.status === 404 || /\b404\b/.test(err.message);
    if (!is404 || !fallbackKey) throw e;
    return await fetchFacturapiFile(fallbackKey, facturapiId, tipo);
  }
}


export async function uploadToBucket(
  admin: ReturnType<typeof createClient>,
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  const { error } = await admin.storage.from('facturas-pdf').upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Storage upload ${path}: ${error.message}`);
}

export function sanitizeDownloadFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'archivo';
}

export async function signUrl(
  admin: ReturnType<typeof createClient>, path: string, downloadFilename?: string,
): Promise<string> {
  const opts = downloadFilename ? { download: downloadFilename } : undefined;
  const { data, error } = await admin.storage.from('facturas-pdf').createSignedUrl(path, SIGNED_URL_TTL, opts);
  if (error || !data) throw new Error(`Signed URL ${path}: ${error?.message}`);
  return data.signedUrl;
}

export function parseBody(body: Record<string, unknown>): SendParsed {
  const destinatarios = Array.isArray(body.destinatarios) ? (body.destinatarios as Destinatario[]) : [];
  const ccEmails = Array.isArray(body.cc) ? (body.cc as string[]).filter((e) => EMAIL_RE.test(e)) : [];
  return {
    destinatarios,
    validRecipients: destinatarios.filter((d) => d?.email && EMAIL_RE.test(d.email)),
    ccEmails,
    mensaje: typeof body.mensaje === 'string' ? body.mensaje : '',
    asunto: typeof body.asunto === 'string' ? body.asunto : '',
    totalFormateado: typeof body.total_formateado === 'string' ? body.total_formateado : undefined,
    ejecutivo: (body.ejecutivo ?? {}) as { nombre?: string; email?: string; telefono?: string },
  };
}

export async function sendToRecipients(params: {
  supabaseUrl: string;
  supabaseServiceKey: string;
  recipients: { email: string; nombre?: string; tipo: 'to' | 'cc' }[];
  templateData: Record<string, unknown>;
  facturaId: string;
  timestamp: number;
}): Promise<{ email: string; tipo: string; ok: boolean; error?: string }[]> {
  const { supabaseUrl, supabaseServiceKey, recipients, templateData, facturaId, timestamp } = params;
  const admin = createClient(supabaseUrl, supabaseServiceKey);
  const resultados: { email: string; tipo: string; ok: boolean; error?: string }[] = [];
  for (const r of recipients) {
    const idem = `fac-${facturaId}-${timestamp}-${r.email}`;
    const envio = await enviarEmailPlantilla(admin, {
      templateName: 'factura-enviada',
      recipientEmail: r.email,
      idempotencyKey: idem,
      templateData: { ...templateData, contacto: r.nombre },
    });
    if (!envio.ok && !envio.suprimido) {
      await captureEdgeException(new Error(envio.error ?? 'Error al enviar correo'), {
        fn: 'enviar-factura-email',
        extra: { phase: 'send_recipient', recipient_index: resultados.length, recipient_type: r.tipo, factura_id: facturaId },
      });
    }
    resultados.push({ email: r.email, tipo: r.tipo, ok: envio.ok, error: envio.ok ? undefined : envio.error });
  }
  return resultados;
}

export interface AuthedCtx {
  userId: string;
  userEmail: string;
  admin: ReturnType<typeof createClient>;
  supabaseUrl: string;
  supabaseServiceKey: string;
}

export async function authenticateRequest(req: Request, cors: Record<string, string>): Promise<AuthedCtx | Response> {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anon || !service) return json(cors, { error: 'Server configuration error' }, 500);
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) return json(cors, { error: 'Missing authorization' }, 401);
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: authErr } = await userClient.auth.getUser();
  if (authErr || !userData?.user) return json(cors, { error: 'Unauthorized' }, 401);
  return {
    userId: userData.user.id,
    userEmail: userData.user.email ?? '',
    admin: createClient(url, service, { auth: { persistSession: false } }),
    supabaseUrl: url,
    supabaseServiceKey: service,
  };
}

export async function prepareAttachments(
  admin: ReturnType<typeof createClient>,
  factura: FacturaCtx,
  apiKey: string,
  ts: number,
  fallbackKey: string | null = null,
): Promise<{ pdfPath: string; xmlPath: string; pdfLink: string; xmlLink: string }> {
  const basePath = `${factura.organization_id}/${factura.id}/${factura.numero}-${ts}`;
  const pdfPath = `${basePath}.pdf`;
  const xmlPath = `${basePath}.xml`;
  const [pdfBytes, xmlBytes] = await Promise.all([
    fetchFacturapiFileWithFallback(apiKey, fallbackKey, factura.facturapi_id!, 'pdf'),
    fetchFacturapiFileWithFallback(apiKey, fallbackKey, factura.facturapi_id!, 'xml'),
  ]);
  await uploadToBucket(admin, pdfPath, pdfBytes, 'application/pdf');
  await uploadToBucket(admin, xmlPath, xmlBytes, 'application/xml');
  // Se mantiene la carga de orgSlug por compatibilidad con otros consumidores
  // aunque ya no se prefija al nombre descargable.
  await fetchOrgSlug(admin as unknown as Parameters<typeof fetchOrgSlug>[0], factura.organization_id);
  const folioSerie = factura.numero || `${factura.serie ?? ''}${factura.folio_fiscal ?? ''}`;
  const [pdfLink, xmlLink] = await Promise.all([
    signUrl(admin, pdfPath, buildFilename({
      tipo: 'Factura',
      folioSerie,
      cliente: factura.cliente_nombre,
      fecha: factura.fecha_emision,
      ext: 'pdf',
    })),
    signUrl(admin, xmlPath, buildFilename({
      tipo: 'Factura',
      folioSerie,
      cliente: factura.cliente_nombre,
      fecha: factura.fecha_emision,
      ext: 'xml',
    })),
  ]);
  return { pdfPath, xmlPath, pdfLink, xmlLink };
}

