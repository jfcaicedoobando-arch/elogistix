/**
 * Helpers de persistencia para `enviar-factura-email`. Extraídos de
 * `helpers.ts` para respetar el límite `max-lines` del linter.
 */
import type { AuthedCtx, FacturaCtx, SendParsed } from './helpers.ts';

export function buildTemplateData(factura: FacturaCtx, parsed: SendParsed, pdfLink: string, xmlLink: string) {
  const fechaEmision = factura.fecha_emision
    ? new Date(factura.fecha_emision).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' })
    : undefined;
  return {
    numero: factura.numero,
    cliente: factura.cliente_nombre ?? '',
    total: parsed.totalFormateado,
    moneda: factura.moneda ?? undefined,
    uuid: factura.uuid_fiscal ?? undefined,
    fechaEmision,
    metodoPago: factura.metodo_pago ?? undefined,
    formaPago: factura.forma_pago ?? undefined,
    mensaje: parsed.mensaje,
    enlacePdf: pdfLink,
    enlaceXml: xmlLink,
    ejecutivoNombre: parsed.ejecutivo.nombre,
    ejecutivoEmail: parsed.ejecutivo.email,
    ejecutivoTelefono: parsed.ejecutivo.telefono,
  };
}

export async function persistEnvio(params: {
  ctx: AuthedCtx;
  factura: FacturaCtx;
  parsed: SendParsed;
  paths: { pdfPath: string; xmlPath: string; pdfLink: string; xmlLink: string };
  resultados: { email: string; tipo: string; ok: boolean; error?: string }[];
  estado: string;
  anyOk: boolean;
}): Promise<string | null> {
  const { ctx, factura, parsed, paths, resultados, estado, anyOk } = params;
  const anyFail = resultados.some((r) => !r.ok);
  const { data: envio } = await ctx.admin.from('factura_envios').insert({
    factura_id: factura.id,
    organization_id: factura.organization_id,
    enviado_por: ctx.userId,
    destinatarios: parsed.validRecipients,
    cc: parsed.ccEmails,
    asunto: parsed.asunto,
    mensaje: parsed.mensaje,
    pdf_storage_path: paths.pdfPath,
    xml_storage_path: paths.xmlPath,
    pdf_link_publico: paths.pdfLink,
    xml_link_publico: paths.xmlLink,
    estado,
    error: anyFail ? JSON.stringify(resultados.filter((r) => !r.ok)) : null,
  }).select('id').single();
  await ctx.admin.from('bitacora_actividad').insert({
    organization_id: factura.organization_id,
    usuario_id: ctx.userId,
    usuario_email: ctx.userEmail,
    modulo: 'facturacion',
    accion: anyOk ? 'factura_enviada_email' : 'factura_envio_email_fallido',
    entidad_id: factura.id,
    entidad_nombre: factura.numero,
    detalles: { envio_id: envio?.id ?? null, destinatarios: parsed.validRecipients.map((d) => d.email), cc: parsed.ccEmails, resultados },
  }).then(() => null, () => null);
  return envio?.id ?? null;
}
