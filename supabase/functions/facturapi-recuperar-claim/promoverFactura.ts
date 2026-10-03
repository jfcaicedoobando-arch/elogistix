/** Promoción CAS de una factura recuperada y sincronización del uso CFDI efectivo. */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import type { FacturaRow } from './recuperar.ts';
import type { FapiInvoice, UserIdentity } from './recuperar.tipos.ts';
import { FACTURAPI_BASE } from '../_shared/facturapiAuth.ts';
import { respaldarXmlTimbrado } from '../_shared/respaldarXmlTimbrado.ts';
import { resolverUsoCfdiEfectivo } from '../_shared/usoCfdiEfectivo.ts';
import { registrarBitacoraEdge } from '../_shared/bitacora.ts';
import { jsonResponse } from '../_shared/response.ts';

export interface PromoverInput {
  supabase: SupabaseClient; factura: FacturaRow; match: FapiInvoice; claimTag: string; user: UserIdentity; ambiente: string;
  apiKey?: string;
}

export async function promoverFactura(input: PromoverInput): Promise<Response> {
  const { supabase, factura, match, claimTag, user, ambiente } = input;
  const facturapiId = match.id!;
  const uuid = match.uuid!;
  const folio = match.folio_number ?? 0;
  const serieTimbrada = match.series ?? factura.serie ?? "";
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;
  const respaldo = input.apiKey ? await respaldarXmlTimbrado({
    supabase, apiKey: input.apiKey, facturapiId, organizationId: factura.organization_id,
    uuid, folder: "emitidas",
  }) : null;
  const { uso: usoCfdiEfectivo, fuente } = resolverUsoCfdiEfectivo(respaldo?.usoCfdi, match.use);
  const { error: updErr, data: updRow } = await supabase
    .from("facturas")
    .update({
      ...(usoCfdiEfectivo ? { uso_cfdi: usoCfdiEfectivo } : {}),
      ...(respaldo?.path ? { factura_xml_backup_path: respaldo.path } : {}),
      numero: `${serieTimbrada}${folio}`, facturapi_id: facturapiId, facturapi_claim_at: null,
      // P0-A: el intento pendiente quedó resuelto.
      facturapi_pendiente_id: null, facturapi_pendiente_at: null,
      uuid_fiscal: uuid, folio_fiscal: folio, serie: serieTimbrada,
      factura_pdf_url: pdfUrl, factura_xml_url: xmlUrl, estado: "Emitida", ambiente,
      timbrado_en: match.date ?? new Date().toISOString(), timbrado_por: user.id,
    })
    .eq("id", factura.id)
    .eq("facturapi_id", claimTag)
    .select("id")
    .maybeSingle();
  if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);
  if (!updRow) return jsonResponse({ outcome: "claim_perdido", message: "El claim cambió mientras se recuperaba; revisa el estado actual." }, 409);

  await registrarBitacoraEdge(supabase, {
    organizationId: factura.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
    accion: "facturapi_claim_recuperado_promovido", entidadId: factura.id, entidadNombre: `${serieTimbrada}${folio}`,
    detalles: {
      facturapi_id: facturapiId, uuid, folio, serie: serieTimbrada, external_id: claimTag,
      uso_cfdi_solicitado: factura.uso_cfdi ?? null, uso_cfdi_efectivo: usoCfdiEfectivo,
      fuente_uso_cfdi: fuente,
    },
  });
  return jsonResponse({ outcome: "promovido", message: "Se recuperó el CFDI que ya estaba timbrado en FacturAPI.", facturapi_id: facturapiId, uuid, folio, serie: serieTimbrada });
}
