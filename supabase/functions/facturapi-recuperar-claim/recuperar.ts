/**
 * Lógica de negocio de `facturapi-recuperar-claim` extraída para reducir la
 * complejidad ciclomática del handler HTTP.
 */
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";
import { FACTURAPI_BASE } from "../facturapi-emitir/helpers.ts";
import { withFacturapiTimeout, FacturapiTimeoutError } from "../_shared/facturapiClient.ts";

export const MIN_EDAD_MINUTOS = 3;

export interface ReqBody { factura_id?: string }
export interface FacturaRow {
  id: string;
  organization_id: string;
  facturapi_id: string | null;
  facturapi_claim_at: string | null;
  serie: string | null;
  numero: string | null;
}
export interface UserIdentity { id: string; email?: string | null }

export interface FapiInvoice {
  id?: string;
  uuid?: string;
  folio_number?: number;
  series?: string;
  external_id?: string;
  status?: string;
  date?: string;
}
interface FapiListResponse { data?: FapiInvoice[]; total_pages?: number; page?: number }
export interface FapiClient { invoices: { list: (params: Record<string, unknown>) => Promise<FapiListResponse> } }

export async function loadFactura(supabase: SupabaseClient, facturaId: string): Promise<FacturaRow | Response> {
  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select("id, organization_id, facturapi_id, facturapi_claim_at, serie, numero")
    .eq("id", facturaId)
    .maybeSingle<FacturaRow>();
  if (fErr || !factura) return jsonResponse({ error: "factura_not_found", detail: fErr?.message }, 404);
  return factura;
}

export function validarClaim(factura: FacturaRow): { claimTag: string; edadMin: number; response?: Response } {
  const claimTag = factura.facturapi_id ?? "";
  if (!claimTag.startsWith("PENDING:")) {
    return {
      claimTag, edadMin: 0,
      response: jsonResponse({ outcome: "no_pending", message: "La factura no tiene un claim pendiente.", facturapi_id: factura.facturapi_id }),
    };
  }
  const edadMin = factura.facturapi_claim_at
    ? (Date.now() - new Date(factura.facturapi_claim_at).getTime()) / 60_000
    : Infinity;
  if (edadMin < MIN_EDAD_MINUTOS) {
    return {
      claimTag, edadMin,
      response: jsonResponse({ outcome: "too_early", message: `El claim aún está dentro del umbral de gracia (${MIN_EDAD_MINUTOS} min).`, edad_minutos: Math.round(edadMin * 10) / 10 }, 425),
    };
  }
  return { claimTag, edadMin };
}

export async function buscarCfdiPorExternalId(client: FapiClient, claimTag: string, claimAt: string | null): Promise<FapiInvoice | null | Response> {
  try {
    const desde = claimAt
      ? new Date(new Date(claimAt).getTime() - 5 * 60_000).toISOString()
      : new Date(Date.now() - 24 * 3600_000).toISOString();
    let page = 1;
    const maxPages = 5;
    while (page <= maxPages) {
      // FIX-04/32 — timeout defensivo en el SDK.
      const res = await withFacturapiTimeout(
        "invoices.list",
        client.invoices.list({ page, limit: 50, "date[gt]": desde }),
      );
      const items = res.data ?? [];
      const match = items.find((inv) => inv.external_id === claimTag) ?? null;
      if (match) return match;
      if (!res.total_pages || page >= (res.total_pages ?? 1)) break;
      page += 1;
    }
    return null;
  } catch (err) {
    if (err instanceof FacturapiTimeoutError) {
      return jsonResponse({ error: "facturapi_timeout", message: err.message, timeout_ms: err.timeoutMs }, 504);
    }
    const detail = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: "facturapi_error", message: detail }, 502);
  }
}

export interface PromoverInput {
  supabase: SupabaseClient; factura: FacturaRow; match: FapiInvoice; claimTag: string; user: UserIdentity; ambiente: string;
}

export async function promoverFactura(input: PromoverInput): Promise<Response> {
  const { supabase, factura, match, claimTag, user, ambiente } = input;
  const facturapiId = match.id!;
  const uuid = match.uuid!;
  const folio = match.folio_number ?? 0;
  const serieTimbrada = match.series ?? factura.serie ?? "";
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;
  const { error: updErr, data: updRow } = await supabase
    .from("facturas")
    .update({
      numero: `${serieTimbrada}${folio}`, facturapi_id: facturapiId, facturapi_claim_at: null,
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
    detalles: { facturapi_id: facturapiId, uuid, folio, serie: serieTimbrada, external_id: claimTag },
  });
  return jsonResponse({ outcome: "promovido", message: "Se recuperó el CFDI que ya estaba timbrado en FacturAPI.", facturapi_id: facturapiId, uuid, folio, serie: serieTimbrada });
}

export async function liberarClaim(
  supabase: SupabaseClient, factura: FacturaRow, claimTag: string, edadMin: number, user: UserIdentity,
): Promise<Response> {
  const { data: liberado, error: rpcErr } = await supabase.rpc(
    "liberar_claim_facturapi_huerfano",
    { p_factura_id: factura.id, p_min_edad_minutos: MIN_EDAD_MINUTOS },
  );
  if (rpcErr) return jsonResponse({ error: "release_failed", detail: rpcErr.message }, 500);

  await registrarBitacoraEdge(supabase, {
    organizationId: factura.organization_id, usuarioId: user.id, usuarioEmail: user.email, modulo: "facturacion",
    accion: "facturapi_claim_recuperado_liberado", entidadId: factura.id, entidadNombre: factura.numero ?? "",
    detalles: { liberado: !!liberado, external_id: claimTag, edad_minutos: Math.round(edadMin * 10) / 10 },
  });

  return jsonResponse({
    outcome: liberado ? "liberado" : "sin_cambios",
    message: liberado
      ? "No hay CFDI timbrado en FacturAPI; se liberó el claim para reintentar."
      : "No hay CFDI en FacturAPI, pero el claim ya no cumplía condiciones para liberarse.",
    edad_minutos: Math.round(edadMin * 10) / 10,
  });
}
