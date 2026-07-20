/**
 * facturapi-recuperar-claim — Recupera facturas atascadas con `facturapi_id`
 * en formato `PENDING:<uuid>` (v13.303.2 / FIX-04.1).
 *
 * Escenario: `facturapi-emitir` reclama la fila con `PENDING:<uuid>` y envía ese
 * tag a FacturAPI como `external_id`. Si el edge muere entre el `invoices.create`
 * y el `UPDATE` final, la fila queda "huérfana": bloqueada para retimbrar pero
 * sin `uuid_fiscal`. Este endpoint reconcilia el estado consultando FacturAPI:
 *
 *   1. Si hay un CFDI con `external_id == claimTag` → promueve la fila con los
 *      datos reales (facturapi_id, uuid, folio, serie, urls).
 *   2. Si NO hay CFDI y el claim ya rebasó el umbral de gracia → llama al RPC
 *      `liberar_claim_facturapi_huerfano` para dejar la fila lista para retimbrar.
 *   3. Si el claim aún está dentro del umbral, responde `too_early`.
 *
 * Entrada: { factura_id: string }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { getFacturapiClient } from "../_shared/facturapiClient.ts";
import { authorizeOrgMembership } from "../_shared/auth.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";
import { FACTURAPI_BASE } from "../facturapi-emitir/helpers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Umbral (min) antes de considerar un claim huérfano y liberar/promover. */
const MIN_EDAD_MINUTOS = 3;

interface ReqBody { factura_id?: string }
interface FapiInvoice {
  id?: string;
  uuid?: string;
  folio_number?: number;
  series?: string;
  external_id?: string;
  status?: string;
  date?: string;
}
interface FapiListResponse {
  data?: FapiInvoice[];
  total_pages?: number;
  page?: number;
}
interface FacturaRow {
  id: string;
  organization_id: string;
  facturapi_id: string | null;
  facturapi_claim_at: string | null;
  serie: string | null;
  numero: string | null;
}

Deno.serve(wrapEdgeHandler("facturapi-recuperar-claim", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userData, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userData.user) return jsonResponse({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as ReqBody;
  if (!body.factura_id) return jsonResponse({ error: "factura_id_required" }, 400);

  const { data: factura, error: fErr } = await supabase
    .from("facturas")
    .select("id, organization_id, facturapi_id, facturapi_claim_at, serie, numero")
    .eq("id", body.factura_id)
    .maybeSingle<FacturaRow>();
  if (fErr || !factura) return jsonResponse({ error: "factura_not_found", detail: fErr?.message }, 404);

  if (!(await authorizeOrgMembership(supabase, userData.user.id, factura.organization_id))) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const claimTag = factura.facturapi_id ?? "";
  if (!claimTag.startsWith("PENDING:")) {
    return jsonResponse({
      outcome: "no_pending",
      message: "La factura no tiene un claim pendiente.",
      facturapi_id: factura.facturapi_id,
    });
  }

  const edadMin = factura.facturapi_claim_at
    ? (Date.now() - new Date(factura.facturapi_claim_at).getTime()) / 60_000
    : Infinity;

  if (edadMin < MIN_EDAD_MINUTOS) {
    return jsonResponse({
      outcome: "too_early",
      message: `El claim aún está dentro del umbral de gracia (${MIN_EDAD_MINUTOS} min).`,
      edad_minutos: Math.round(edadMin * 10) / 10,
    }, 425);
  }

  const resolved = await getFacturapiClient(supabase, factura.organization_id);
  if (!resolved.ok) {
    return jsonResponse({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  }

  // 1) Buscar el CFDI en FacturAPI por external_id (== claimTag).
  const client = resolved.data.client as {
    invoices: { list: (params: Record<string, unknown>) => Promise<FapiListResponse> };
  };
  let match: FapiInvoice | null = null;
  try {
    // FacturAPI filtra invoices por rango de fecha; buscamos desde 5 min antes
    // del claim para evitar quedarnos cortos por clock skew.
    const desde = factura.facturapi_claim_at
      ? new Date(new Date(factura.facturapi_claim_at).getTime() - 5 * 60_000).toISOString()
      : new Date(Date.now() - 24 * 3600_000).toISOString();
    let page = 1;
    const maxPages = 5; // 5 * 50 = 250 CFDIs por revisión es más que suficiente.
    while (page <= maxPages) {
      const res = await client.invoices.list({ page, limit: 50, "date[gt]": desde });
      const items = res.data ?? [];
      match = items.find((inv) => inv.external_id === claimTag) ?? null;
      if (match) break;
      if (!res.total_pages || page >= (res.total_pages ?? 1)) break;
      page += 1;
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: "facturapi_error", message: detail }, 502);
  }

  // 2a) Encontrado → promover la fila con los datos reales del CFDI.
  if (match?.id && match.uuid) {
    const folio = match.folio_number ?? 0;
    const serieTimbrada = match.series ?? factura.serie ?? "";
    const pdfUrl = `${FACTURAPI_BASE}/invoices/${match.id}/pdf`;
    const xmlUrl = `${FACTURAPI_BASE}/invoices/${match.id}/xml`;
    const { error: updErr, data: updRow } = await supabase
      .from("facturas")
      .update({
        numero: `${serieTimbrada}${folio}`,
        facturapi_id: match.id,
        facturapi_claim_at: null,
        uuid_fiscal: match.uuid,
        folio_fiscal: folio,
        serie: serieTimbrada,
        factura_pdf_url: pdfUrl,
        factura_xml_url: xmlUrl,
        estado: "Emitida",
        ambiente: resolved.data.ambiente,
        timbrado_en: match.date ?? new Date().toISOString(),
        timbrado_por: userData.user.id,
      })
      .eq("id", factura.id)
      .eq("facturapi_id", claimTag) // sigue siendo un claim atómico
      .select("id")
      .maybeSingle();
    if (updErr) return jsonResponse({ error: "db_update_failed", detail: updErr.message }, 500);
    if (!updRow) {
      return jsonResponse({
        outcome: "claim_perdido",
        message: "El claim cambió mientras se recuperaba; revisa el estado actual.",
      }, 409);
    }
    await registrarBitacoraEdge(supabase, {
      organizationId: factura.organization_id,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "facturapi_claim_recuperado_promovido",
      entidadId: factura.id,
      entidadNombre: `${serieTimbrada}${folio}`,
      detalles: { facturapi_id: match.id, uuid: match.uuid, folio, serie: serieTimbrada, external_id: claimTag },
    });
    return jsonResponse({
      outcome: "promovido",
      message: "Se recuperó el CFDI que ya estaba timbrado en FacturAPI.",
      facturapi_id: match.id,
      uuid: match.uuid,
      folio,
      serie: serieTimbrada,
    });
  }

  // 2b) No encontrado → liberar el claim vía RPC (respeta membresía + umbral).
  const { data: liberado, error: rpcErr } = await supabase.rpc(
    "liberar_claim_facturapi_huerfano",
    { p_factura_id: factura.id, p_min_edad_minutos: MIN_EDAD_MINUTOS },
  );
  if (rpcErr) return jsonResponse({ error: "release_failed", detail: rpcErr.message }, 500);

  await registrarBitacoraEdge(supabase, {
    organizationId: factura.organization_id,
    usuarioId: userData.user.id,
    usuarioEmail: userData.user.email,
    modulo: "facturacion",
    accion: "facturapi_claim_recuperado_liberado",
    entidadId: factura.id,
    entidadNombre: factura.numero ?? "",
    detalles: { liberado: !!liberado, external_id: claimTag, edad_minutos: Math.round(edadMin * 10) / 10 },
  });

  return jsonResponse({
    outcome: liberado ? "liberado" : "sin_cambios",
    message: liberado
      ? "No hay CFDI timbrado en FacturAPI; se liberó el claim para reintentar."
      : "No hay CFDI en FacturAPI, pero el claim ya no cumplía condiciones para liberarse.",
    edad_minutos: Math.round(edadMin * 10) / 10,
  });
}));
