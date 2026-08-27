/**
 * Helpers de `handleSend` extraídos de `handlers.ts` para respetar el límite de
 * 250 líneas por archivo (Power of 10 · regla de tamaño).
 *
 * Contiene el saneado del body, la resolución server-side del PDF (W-02) y del
 * ejecutivo desde la sesión (W-04).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { isEmail } from './emailValidation.ts';

export const BUCKET_PDF = 'cotizaciones-pdf';

export interface Destinatario { email: string; nombre?: string }

export interface Cotizacion {
  id: string; folio: string; organization_id: string; cliente_nombre: string;
  cliente_id?: string | null;
  origen: string; destino: string; incoterm: string; modo: string;
  fecha_vigencia: string | null; estado: string;
}

export interface Ejecutivo { nombre?: string; email?: string; telefono?: string }

export interface SendBodyParsed {
  destinatarios: Destinatario[];
  validRecipients: Destinatario[];
  ccEmails: string[];
  mensaje: string;
  asunto: string;
  pdfStoragePath: string;
  marcarEnviada: boolean;
  totales: { mxn?: string; usd?: string };
  ejecutivo: Ejecutivo;
}

/** Sanea un total mostrado en el correo: texto corto, sin HTML. */
function saneaTotal(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const limpio = valor.replace(/[<>]/g, '').trim().slice(0, 40);
  return limpio || undefined;
}

export function parseSendBody(body: Record<string, unknown>): SendBodyParsed {
  const destinatarios = Array.isArray(body.destinatarios) ? (body.destinatarios as Destinatario[]) : [];
  const ccEmails = Array.isArray(body.cc) ? (body.cc as string[]).filter(isEmail) : [];
  const totales = (body.totales ?? {}) as { mxn?: unknown; usd?: unknown };
  return {
    destinatarios,
    validRecipients: destinatarios.filter((d) => d?.email && isEmail(d.email)),
    ccEmails,
    mensaje: typeof body.mensaje === 'string' ? body.mensaje : '',
    asunto: typeof body.asunto === 'string' ? body.asunto : '',
    // W-02 (auditoría R2): `body.pdf_path` se IGNORA. El path se resuelve
    // server-side bajo `${organization_id}/${cotizacion_id}/`; antes cualquier
    // miembro podía pedir un link firmado a CUALQUIER PDF del bucket, incluido
    // el de otra organización.
    pdfStoragePath: '',
    marcarEnviada: body.marcar_enviada !== false,
    totales: { mxn: saneaTotal(totales.mxn), usd: saneaTotal(totales.usd) },
    // W-04: el ejecutivo se resuelve desde la sesión, nunca desde el body.
    ejecutivo: {},
  };
}

/**
 * W-02: resuelve el PDF más reciente subido para ESTA cotización. El prefijo
 * lo construye el servidor con la org y el id de la cotización ya validados,
 * así que es imposible firmar un archivo ajeno.
 */
export async function resolverPdfPath(
  admin: ReturnType<typeof createClient>,
  cot: Cotizacion,
): Promise<string | null> {
  const prefijo = `${cot.organization_id}/${cot.id}`;
  const { data: archivos, error } = await admin
    .storage.from(BUCKET_PDF)
    .list(prefijo, { limit: 20, sortBy: { column: 'created_at', order: 'desc' } });
  if (error || !archivos || archivos.length === 0) return null;
  const pdf = archivos.find((a) => a.name.toLowerCase().endsWith('.pdf'));
  return pdf ? `${prefijo}/${pdf.name}` : null;
}

/** W-04: datos del ejecutivo desde la sesión (no del body, evita suplantación). */
export async function resolverEjecutivo(
  admin: ReturnType<typeof createClient>,
  userId: string,
  userEmail: string,
): Promise<Ejecutivo> {
  const { data } = await admin.auth.admin.getUserById(userId);
  const meta = (data?.user?.user_metadata ?? {}) as Record<string, unknown>;
  const nombre = typeof meta.full_name === 'string' && meta.full_name.trim()
    ? meta.full_name.trim()
    : (data?.user?.email ?? userEmail);
  const telefono = typeof meta.telefono === 'string' ? meta.telefono : undefined;
  return { nombre: nombre || undefined, email: data?.user?.email ?? userEmail, telefono };
}

export function buildTemplateData(
  cot: Cotizacion,
  parsed: SendBodyParsed,
  pdfLink: string,
  enlacePortal: string,
) {
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
