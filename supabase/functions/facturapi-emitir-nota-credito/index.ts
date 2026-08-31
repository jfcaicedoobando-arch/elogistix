/**
 * facturapi-emitir-nota-credito — Timbra una Nota de Crédito (CFDI tipo E)
 * en FacturApi, relacionada a la factura original vía UUID.
 *
 * Entrada: { nota_credito_id: string }
 * Salida: { uuid, folio, serie, facturapi_id, pdf_url, xml_url }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import { authorizeOrgRole, ROLES_EMISOR_FISCAL } from "../_shared/auth.ts";
import { getFacturapiClient, describeFacturapiError, extractFacturapiMessage, withFacturapiTimeout, FacturapiTimeoutError } from "../_shared/facturapiClient.ts";
import { buildNcPayload, validateNcContext, ncTotalEsCero } from "./helpers.ts";
import { preloadNcContext, buildNcContextFromRows, claimNotaCredito } from "./data.ts";
import { respaldarXmlTimbrado } from "../_shared/respaldarXmlTimbrado.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse, makeJson } from "../_shared/response.ts";


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
  releaseClaim: () => Promise<void>,
): Promise<{ ok: true; invoice: FapiInvoice } | { ok: false; body: unknown; status: number }> {
  try {
    // Ola 4 · N1: timeout defensivo (patrón FIX-04/32 de facturapi-emitir):
    // si FacturAPI cuelga, devolvemos 504.
    const invoice = await withFacturapiTimeout("invoices.create", facturapi.invoices.create(payload)) as FapiInvoice;
    return { ok: true, invoice };
  } catch (err) {
    if (err instanceof FacturapiTimeoutError) {
      // EF-02 (auditoría): en timeout NO liberamos el claim — si FacturAPI sí
      // timbró, recuperar-claim lo promueve por external_id; si no timbró, lo
      // libera pasado el umbral (MIN_EDAD_MINUTOS). Liberarlo aquí perdía la
      // correlación y el reintento duplicaba la NC.
      await registrarBitacoraEdge(supabase, {
        organizationId: meta.organizationId,
        usuarioId: meta.userId,
        usuarioEmail: meta.userEmail,
        modulo: "facturacion",
        accion: "facturapi_nc_emitir_timeout",
        entidadId: meta.notaCreditoId,
        detalles: { op: err.op, timeout_ms: err.timeoutMs },
      });
      return { ok: false, body: { error: "facturapi_timeout", message: `${err.message}. Espera ~3 min y usa 'Recuperar timbrado' — no reintentes el timbrado directamente.`, timeout_ms: err.timeoutMs }, status: 504 };
    }
    // Error definitivo de FacturAPI (no timbró): liberar el claim para reintentar.
    await releaseClaim();
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
  // EF-10: endpoints con JWT usan CORS de whitelist (guía _shared/cors.ts).
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const json = makeJson(req);
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: uErr } = await supabase.auth.getUser();
  if (uErr || !userData.user) return json({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as ReqBody;
  if (!body.nota_credito_id) return json({ error: "nota_credito_id_required" }, 400);

  const pre = await preloadNcContext(supabase, body.nota_credito_id);
  if (!pre.ok) return json(pre.body, pre.status);
  const { nc, factura, cliente, email, referencias } = pre;
  if (!(await authorizeOrgRole(supabase, userData.user.id, nc.organization_id, ROLES_EMISOR_FISCAL))) {
    return json({ error: "forbidden" }, 403);
  }

  const resolved = await getFacturapiClient(supabase, nc.organization_id);
  if (!resolved.ok) return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);

  const ctx = buildNcContextFromRows(nc, factura, cliente, email, referencias);
  const issues = validateNcContext(ctx);
  if (issues.length > 0) return json({ error: "validation_failed", issues }, 422);

  // Ola 4 · A — una NC en $0 no es timbrable (el SAT la rechaza y en la
  // práctica es captura incompleta). Se valida ANTES del claim y del PAC.
  if (ncTotalEsCero(ctx)) {
    return json({
      error: "nc_total_cero",
      message: "La nota de crédito tiene un total de $0. Revisa los conceptos (cantidad y precio) antes de timbrar.",
    }, 422);
  }


  // Ola 4 · N1: claim atómico ANTES de timbrar (patrón facturapi-emitir).
  // Se toma DESPUÉS de validar para no tener que liberarlo en el 422.
  // El tag viaja como external_id a FacturAPI para recuperar el CFDI si la
  // edge muere tras timbrar y antes de persistir.
  const claim = await claimNotaCredito(supabase, body.nota_credito_id);
  if (!claim.ok) return json(claim.body, claim.status);
  ctx.external_id = claim.claimTag;

  const created = await createNcInvoice(supabase, resolved.data.client, buildNcPayload(ctx), {
    organizationId: nc.organization_id,
    userId: userData.user.id,
    userEmail: userData.user.email,
    notaCreditoId: body.nota_credito_id,
  }, claim.release);
  if (!created.ok) return json(created.body, created.status);

  const persisted = await persistTimbradoNc({
    supabase,
    invoice: created.invoice,
    ctx,
    nc,
    apiKey: resolved.data.apiKey,
    ambiente: resolved.data.ambiente,
    notaCreditoId: body.nota_credito_id,
    claimTag: claim.claimTag,
    userId: userData.user.id,
    userEmail: userData.user.email,
  });
  if (!persisted.ok) return json(persisted.body, persisted.status);
  return json(persisted.body);
}));

interface PersistNcArgs {
  supabase: ReturnType<typeof createClient>;
  invoice: { id: string; uuid: string; folio_number?: number; folio?: number; series?: string };
  ctx: ReturnType<typeof buildNcContextFromRows>;
  nc: { organization_id: string; factura_id: string };
  apiKey: string;
  ambiente: string;
  notaCreditoId: string;
  claimTag: string;
  userId: string;
  userEmail: string | undefined;
}

async function persistTimbradoNc(args: PersistNcArgs): Promise<{ ok: true; body: unknown } | { ok: false; body: unknown; status: number }> {
  const { supabase, invoice, ctx, nc, apiKey, ambiente, notaCreditoId, claimTag, userId, userEmail } = args;
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

  const { error: updErr, data: updRow } = await supabase
    .from("factura_notas_credito")
    .update({
      folio: folioFinal,
      facturapi_id: facturapiId,
      facturapi_claim_at: null,
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
    .eq("id", notaCreditoId)
    // Ola 4 · N1: persistir sólo si seguimos poseyendo el claim — evita
    // pisar el facturapi_id de otro timbrado concurrente.
    .eq("facturapi_id", claimTag)
    .select("id")
    .maybeSingle();
  if (updErr) return { ok: false, body: { error: "db_update_failed", detail: updErr.message }, status: 500 };
  if (!updRow) return { ok: false, body: { error: "claim_perdido", message: "El claim de timbrado se perdió; verifica el estado en Facturapi.", facturapi_id: facturapiId, uuid }, status: 409 };

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
