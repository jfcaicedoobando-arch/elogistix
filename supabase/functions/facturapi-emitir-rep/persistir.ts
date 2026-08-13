/**
 * Persistencia del REP timbrado: respaldo del XML, update del pago con validación
 * de claim y bitácora. Extraído de index.ts (v13.559.3) para mantener el handler
 * por debajo del límite de 200 líneas.
 */
import { FACTURAPI_BASE } from "../_shared/facturapiAuth.ts";
import { respaldarXmlTimbrado } from "../_shared/respaldarXmlTimbrado.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";

interface FapiInvoice {
  id: string;
  uuid: string;
  folio_number?: number;
  folio?: number;
  series?: string;
}

interface Params {
  // SAFE-CAST: cliente de Supabase creado en index.ts.
  supabase: ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.45.0").createClient>;
  invoice: FapiInvoice;
  apiKey: string;
  ambiente: string;
  claimTag: string;
  pagoId: string;
  facturaId: string;
  organizationId: string;
  usuarioId: string;
  usuarioEmail?: string;
  json: (body: unknown, status?: number) => Response;
}

/** Guarda el REP timbrado; devuelve la respuesta final (éxito o error). */
export async function persistirRepTimbrado(p: Params): Promise<Response> {
  const facturapiId = p.invoice.id;
  const uuid = p.invoice.uuid;
  const folio = p.invoice.folio_number ?? p.invoice.folio ?? 0;
  const serie = p.invoice.series ?? "";
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;

  // Ola 3 · Item 5 — Respaldo automático del XML timbrado (best-effort).
  const respaldo = await respaldarXmlTimbrado({
    supabase: p.supabase,
    apiKey: p.apiKey,
    facturapiId,
    organizationId: p.organizationId,
    uuid,
    folder: "rep",
  });

  const { error: updErr, data: updRow } = await p.supabase
    .from("pagos_factura")
    .update({
      facturapi_rep_id: facturapiId,
      facturapi_rep_claim_at: null,
      uuid_rep: uuid,
      folio_rep: folio,
      serie_rep: serie,
      rep_pdf_url: pdfUrl,
      rep_xml_url: xmlUrl,
      rep_xml_backup_path: respaldo.path,
      estado_rep: "Timbrado",
      ambiente: p.ambiente,
      timbrado_rep_en: new Date().toISOString(),
      timbrado_rep_por: p.usuarioId,
      rep_error: null,
    })
    .eq("id", p.pagoId)
    // EF-01: persistir sólo si seguimos poseyendo el claim (patrón emitir/NC).
    .eq("facturapi_rep_id", p.claimTag)
    .select("id")
    .maybeSingle();
  if (updErr) return p.json({ error: "db_update_failed", detail: updErr.message }, 500);
  if (!updRow) {
    return p.json({
      error: "claim_perdido",
      message: "El claim de timbrado se perdió; usa 'Recuperar timbrado' con este pago.",
      facturapi_id: facturapiId,
      uuid,
    }, 409);
  }

  await registrarBitacoraEdge(p.supabase, {
    organizationId: p.organizationId,
    usuarioId: p.usuarioId,
    usuarioEmail: p.usuarioEmail,
    modulo: "facturacion",
    accion: "facturapi_rep_emitido",
    entidadId: p.pagoId,
    detalles: {
      uuid, folio, serie, facturapi_id: facturapiId, factura_id: p.facturaId,
      xml_backup: { status: respaldo.status, path: respaldo.path, error: respaldo.error ?? null },
    },
  });

  return p.json({
    uuid, folio, serie, facturapi_id: facturapiId,
    pdf_url: pdfUrl, xml_url: xmlUrl, xml_backup: respaldo,
  });
}
