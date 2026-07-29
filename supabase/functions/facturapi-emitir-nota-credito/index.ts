/**
 * facturapi-emitir-nota-credito — Timbra una Nota de Crédito (CFDI tipo E)
 * en FacturApi, relacionada a la factura original vía UUID.
 *
 * Entrada: { nota_credito_id: string }
 * Salida: { uuid, folio, serie, facturapi_id, pdf_url, xml_url }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { authorizeOrgRole, ROLES_EMISOR_FISCAL } from "../_shared/auth.ts";
import { getFacturapiClient, describeFacturapiError, extractFacturapiMessage } from "../_shared/facturapiClient.ts";
import { buildNcPayload, validateNcContext } from "./helpers.ts";
import { preloadNcContext, buildNcContextFromRows } from "./data.ts";
import { respaldarXmlTimbrado } from "../_shared/respaldarXmlTimbrado.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
void Deno.env.get("FACTURAPI_KEY");
void resolveFacturapiKey;

const FACTURAPI_BASE = "https://www.facturapi.io/v2";

interface ReqBody { nota_credito_id?: string }

interface FapiInvoice { id: string; uuid: string; folio_number?: number; folio?: number; series?: string }

async function createNcInvoice(
  supabase: ReturnType<typeof createClient>,
  facturapi: { invoices: { create: (p: unknown) => Promise<unknown> } },
  payload: unknown,
  meta: { organizationId: string; userId: string; userEmail: string | undefined; notaCreditoId: string },
): Promise<{ ok: true; invoice: FapiInvoice } | { ok: false; body: unknown; status: number }> {
  try {
    const invoice = await facturapi.invoices.create(payload) as FapiInvoice;
    return { ok: true, invoice };
  } catch (err) {
    const { status, detail } = describeFacturapiError(err);
    await registrarBitacoraEdge(supabase, {
      organizationId: meta.organizationId,
      usuarioId: meta.userId,
      usuarioEmail: meta.userEmail,
      modulo: "facturacion",
      accion: "facturapi_nc_emitir_failed",
      entidadId: meta.notaCreditoId,
      detalles: { status, response: detail },
    });
    const message = extractFacturapiMessage(detail, status);
    return { ok: false, body: { error: "facturapi_error", status, detail, message }, status: 502 };
  }
}

Deno.serve(wrapEdgeHandler("facturapi-emitir-nota-credito", async (req) => {
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
  if (!body.nota_credito_id) return jsonResponse({ error: "nota_credito_id_required" }, 400);

  const pre = await preloadNcContext(supabase, body.nota_credito_id);
  if (!pre.ok) return jsonResponse(pre.body, pre.status);
  const { nc, factura, cliente, email, referencias } = pre;
  if (!(await authorizeOrgRole(supabase, userData.user.id, nc.organization_id, ROLES_EMISOR_FISCAL))) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const resolved = await getFacturapiClient(supabase, nc.organization_id);
  if (!resolved.ok) return jsonResponse({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);

  const ctx = buildNcContextFromRows(nc, factura, cliente, email, referencias);
  const issues = validateNcContext(ctx);
  if (issues.length > 0) return jsonResponse({ error: "validation_failed", issues }, 422);

  const created = await createNcInvoice(supabase, resolved.data.client, buildNcPayload(ctx), {
    organizationId: nc.organization_id,
    userId: userData.user.id,
    userEmail: userData.user.email,
    notaCreditoId: body.nota_credito_id,
  });
  if (!created.ok) return jsonResponse(created.body, created.status);

  const persisted = await persistTimbradoNc({
    supabase,
    invoice: created.invoice,
    ctx,
    nc,
    apiKey: resolved.data.apiKey,
    ambiente: resolved.data.ambiente,
    notaCreditoId: body.nota_credito_id,
    userId: userData.user.id,
    userEmail: userData.user.email,
  });
  if (!persisted.ok) return jsonResponse(persisted.body, persisted.status);
  return jsonResponse(persisted.body);
}));

interface PersistNcArgs {
  supabase: ReturnType<typeof createClient>;
  invoice: { id: string; uuid: string; folio_number?: number; folio?: number; series?: string };
  ctx: ReturnType<typeof buildNcContextFromRows>;
  nc: { organization_id: string; factura_id: string };
  apiKey: string;
  ambiente: string;
  notaCreditoId: string;
  userId: string;
  userEmail: string | undefined;
}

async function persistTimbradoNc(args: PersistNcArgs): Promise<{ ok: true; body: unknown } | { ok: false; body: unknown; status: number }> {
  const { supabase, invoice, ctx, nc, apiKey, ambiente, notaCreditoId, userId, userEmail } = args;
  const facturapiId = invoice.id;
  const uuid = invoice.uuid;
  const folio = invoice.folio_number ?? invoice.folio ?? 0;
  const serieTimbrada = invoice.series ?? ctx.serie ?? "";
  const pdfUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/pdf`;
  const xmlUrl = `${FACTURAPI_BASE}/invoices/${facturapiId}/xml`;

  const respaldo = await respaldarXmlTimbrado({
    supabase,
    apiKey,
    facturapiId,
    organizationId: nc.organization_id,
    uuid,
    folder: "notas-credito",
  });

  // v13.213.20 — FacturAPI = source of truth para el folio de la NC.
  // El borrador arranca con `BORRADOR-<ts>`; al timbrar lo sobreescribimos
  // con `<serie><folio>` (mismo formato que facturas, sin separador).
  const folioFinal = `${serieTimbrada}${folio}`;

  const { error: updErr } = await supabase
    .from("factura_notas_credito")
    .update({
      folio: folioFinal,
      facturapi_id: facturapiId,
      uuid_fiscal: uuid,
      folio_fiscal: folio,
      serie: serieTimbrada,
      pdf_url: pdfUrl,
      xml_url: xmlUrl,
      xml_backup_path: respaldo.path,
      estado: "Timbrada",
      ambiente,
      timbrado_en: new Date().toISOString(),
      timbrado_por: userId,
    })
    .eq("id", notaCreditoId);
  if (updErr) return { ok: false, body: { error: "db_update_failed", detail: updErr.message }, status: 500 };

  await registrarBitacoraEdge(supabase, {
    organizationId: nc.organization_id,
    usuarioId: userId,
    usuarioEmail: userEmail,
    modulo: "facturacion",
    accion: "facturapi_nc_emitida",
    entidadId: notaCreditoId,
    entidadNombre: folioFinal,
    detalles: {
      uuid, folio, serie: serieTimbrada, folio_final: folioFinal,
      facturapi_id: facturapiId, factura_id: nc.factura_id,
      xml_backup: { status: respaldo.status, path: respaldo.path, error: respaldo.error ?? null },
    },
  });

  return { ok: true, body: { uuid, folio, serie: serieTimbrada, facturapi_id: facturapiId, pdf_url: pdfUrl, xml_url: xmlUrl, xml_backup: respaldo } };
}
