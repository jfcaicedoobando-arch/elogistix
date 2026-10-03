/** Guarda la identidad fiscal confirmada con CAS sobre el claim vigente. */
import { FACTURAPI_BASE, type FacturaContext } from './helpers.ts';
import type { FapiInvoice } from './crear.ts';
import type { EmitirInput } from './types.ts';
import type { respaldarXmlEmitido } from './respaldarXml.ts';
import { normalizarUsoCfdi, resolverUsoCfdiEfectivo } from '../_shared/usoCfdiEfectivo.ts';
import { registrarBitacoraEdge } from '../_shared/bitacora.ts';
import { jsonResponse } from '../_shared/response.ts';

export interface TimbradoResultado {
  facturapiId: string;
  uuid: string;
  folio: number;
  serie: string;
  numero: string;
  pdfUrl: string;
  xmlUrl: string;
  usoCfdi: string | null;
}

export function parseInvoiceResult(invoice: FapiInvoice, ctx: FacturaContext): TimbradoResultado {
  const facturapiId = invoice.id;
  const uuid = invoice.uuid;
  const folio = invoice.folio_number ?? invoice.folio ?? 0;
  const serie = invoice.series ?? ctx.serie ?? "";
  const numero = `${serie}${folio}`;
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;
  return { facturapiId, uuid, folio, serie, numero, pdfUrl, xmlUrl, usoCfdi: normalizarUsoCfdi(invoice.use) };
}

export async function persistirFacturaTimbrada(
  input: EmitirInput,
  resultado: TimbradoResultado,
  respaldo: Awaited<ReturnType<typeof respaldarXmlEmitido>>,
): Promise<Response | null> {
  const { supabase, factura, facturaId, user, claim } = input;
  const { facturapiId, uuid, folio, serie, numero, pdfUrl, xmlUrl } = resultado;
  const { uso: usoCfdiEfectivo, fuente } = resolverUsoCfdiEfectivo(respaldo.usoCfdi, resultado.usoCfdi);

  const { error: updErr, data: updRow } = await supabase
    .from("facturas")
    .update({
      ...(usoCfdiEfectivo ? { uso_cfdi: usoCfdiEfectivo } : {}),
      numero, facturapi_id: facturapiId, facturapi_claim_at: null, uuid_fiscal: uuid,
      // P0 correctivo: limpiar cualquier intento pendiente heredado.
      facturapi_pendiente_id: null, facturapi_pendiente_at: null,
      folio_fiscal: folio, serie, factura_pdf_url: pdfUrl, factura_xml_url: xmlUrl,
      factura_xml_backup_path: respaldo.path, estado: "Emitida", ambiente: input.ambiente,
      timbrado_en: new Date().toISOString(), timbrado_por: user.id,
    })
    .eq("id", facturaId)
    .eq("facturapi_id", claim.claimTag)
    .select("id")
    .maybeSingle();

  if (updErr) return jsonResponse({ error: "db_update_failed", message: "El CFDI se timbró pero no se pudo guardar en el sistema. Usa 'Recuperar timbrado' para sincronizarlo.", detail: updErr.message }, 500);
  if (!updRow) return jsonResponse({ error: "claim_perdido", message: "El claim de timbrado se perdió; verifica el estado en Facturapi.", facturapi_id: facturapiId, uuid }, 409);

  // Al timbrar una SUSTITUTA, dejar la relación bidireccional en la original.
  // Sin esto, cuando la original se cancela asíncronamente vía cron
  // (facturapi-reconciliar-cancelaciones) no se detecta que es sustitución
  // y se limpia la proforma incorrectamente (ver bug histórico PRO-2026-0970).
  if (factura.sustituye_a) {
    await supabase
      .from("facturas")
      .update({ sustituida_por: facturaId })
      .eq("id", factura.sustituye_a)
      .is("sustituida_por", null);
  }

  await registrarBitacoraEdge(supabase, {
    organizationId: factura.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
    accion: "facturapi_emitida", entidadId: facturaId, entidadNombre: numero,
    detalles: {
      uuid, folio, serie, facturapi_id: facturapiId,
      uso_cfdi_solicitado: input.ctx.uso_cfdi, uso_cfdi_efectivo: usoCfdiEfectivo,
      fuente_uso_cfdi: fuente,
      xml_backup: { status: respaldo.status, path: respaldo.path, error: respaldo.error ?? null },
    },
  });

  return null;
}
