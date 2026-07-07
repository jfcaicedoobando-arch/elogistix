/**
 * enviar-factura-email — Envía la factura branded al cliente.
 *
 * Homólogo a `enviar-cotizacion-email`, pero descarga el PDF/XML desde
 * FacturApi (una vez timbrada), los sube al bucket privado `facturas-pdf`
 * y firma URLs a 30 días. Encola un correo por destinatario en la plantilla
 * `factura-enviada` y registra el envío en `factura_envios` + bitácora.
 *
 * Los helpers viven en `./helpers.ts` para respetar `max-lines`.
 */
import { wrapEdgeHandler, captureEdgeException } from "../_shared/sentry.ts";
import { buildCors, handlePreflightStrict } from '../_shared/cors.ts';
import { resolveFacturapiKey, resolveFacturapiKeyOtherAmbiente, type SupabaseLike } from '../_shared/facturapiAuth.ts';
import {
  authenticateRequest,
  buildTemplateData,
  json,
  loadFactura,
  parseBody,
  persistEnvio,
  prepareAttachments,
  sendToRecipients,
} from './helpers.ts';

Deno.serve(wrapEdgeHandler("enviar-factura-email", async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  if (req.method !== 'POST') return json(cors, { error: 'Method not allowed' }, 405);

  const authed = await authenticateRequest(req, cors);
  if (authed instanceof Response) return authed;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(cors, { error: 'Invalid JSON' }, 400); }

  const facturaId = String(body.factura_id ?? '');
  if (!facturaId) return json(cors, { error: 'factura_id requerido' }, 400);

  const loaded = await loadFactura(authed.admin, facturaId, authed.userId);
  if ('err' in loaded) return json(cors, { error: loaded.err }, loaded.status);
  const factura = loaded.factura;

  const parsed = parseBody(body);
  if (parsed.validRecipients.length === 0) {
    return json(cors, { error: 'Al menos un destinatario válido es requerido' }, 400);
  }

  const keyRes = await resolveFacturapiKey(authed.admin, factura.organization_id);
  if (!keyRes.ok) return json(cors, { error: keyRes.data.error, message: keyRes.data.message }, keyRes.data.status);

  const ts = Date.now();
  let paths: { pdfPath: string; xmlPath: string; pdfLink: string; xmlLink: string };
  try {
    paths = await prepareAttachments(authed.admin, factura, keyRes.data.apiKey, ts);
  } catch (e) {
    await captureEdgeException(e, { fn: 'enviar-factura-email', extra: { phase: 'fetch_upload_sign', factura_id: factura.id } });
    return json(cors, { error: 'No se pudo preparar los adjuntos', detail: (e as Error).message }, 500);
  }

  const templateData = buildTemplateData(factura, parsed, paths.pdfLink, paths.xmlLink);
  const recipients = [
    ...parsed.validRecipients.map((d) => ({ email: d.email, nombre: d.nombre, tipo: 'to' as const })),
    ...parsed.ccEmails.map((e) => ({ email: e, tipo: 'cc' as const })),
  ];

  const resultados = await sendToRecipients({
    supabaseUrl: authed.supabaseUrl,
    supabaseServiceKey: authed.supabaseServiceKey,
    recipients,
    templateData,
    facturaId: factura.id,
    timestamp: ts,
  });

  const anyOk = resultados.some((r) => r.ok);
  const anyFail = resultados.some((r) => !r.ok);
  const estado = anyOk && anyFail ? 'parcial' : anyOk ? 'enviado' : 'fallido';

  const envioId = await persistEnvio({ ctx: authed, factura, parsed, paths, resultados, estado, anyOk });

  return json(cors, {
    success: anyOk,
    estado,
    envio_id: envioId,
    resultados,
    pdf_link: paths.pdfLink,
    xml_link: paths.xmlLink,
  });
}));
