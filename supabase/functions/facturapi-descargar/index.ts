/**
 * facturapi-descargar — Proxy autenticado para descargar PDF/XML de un CFDI
 * (factura o REP) desde FacturApi.
 *
 * Las URLs guardadas en `facturas.factura_pdf_url|xml_url` y
 * `pagos_factura.rep_pdf_url|xml_url` apuntan al dominio de FacturApi y
 * requieren la API key de la organización (no se pueden abrir desde el
 * navegador). Esta función resuelve la API key por org y devuelve el archivo
 * con los headers correctos.
 *
 * Entrada (POST):
 *   { tipo: "pdf" | "xml", factura_id?: string, pago_id?: string }
 *
 * Salida: archivo binario (Content-Type application/pdf | application/xml)
 *         con Content-Disposition de descarga.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { resolveFacturapiKey, FACTURAPI_BASE, basicAuthHeader } from "../_shared/facturapiAuth.ts";
import { authorizeOrgRole, authorizePortalCliente, ROLES_DESCARGA_CFDI } from "../_shared/auth.ts";
import { extractFacturapiMessage } from "../_shared/facturapiClient.ts";
import { jsonResponse, makeJson } from "../_shared/response.ts";
import { buildFilename, type CfdiTipoDoc } from "../_shared/facturaFilename.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface ReqBody {
  tipo?: "pdf" | "xml";
  factura_id?: string;
  pago_id?: string;
  nota_credito_id?: string;
}

interface ResolvedTarget {
  facturapiId: string;
  organizationId: string;
  tipoDoc: CfdiTipoDoc;
  folioSerie: string;
  clienteId: string | null;
  cliente: string | null;
  fecha: string | null;
}

type Resolved =
  | { ok: true; data: ResolvedTarget }
  | { ok: false; status: number; body: unknown };

/**
 * Ola 4 · N39: `folio` ya incluye la serie desde que se persiste al timbrar
 * (`<serie><folio>`, v13.213.20). Concatenar serie+folio de nuevo duplicaba
 * la serie ("NCNC7.pdf"). Fallback defensivo sólo para filas legacy con
 * `folio` vacío. Extraída como función pura exportada para poder testearla
 * sin mockear Supabase.
 */
export function resolveFolioSerieNc(serie: string, folio: string): string {
  return folio || `${serie}${folio}`;
}

/**
 * Datos heredados de la factura padre (cliente/fecha). Extraído para bajar la
 * complejidad de los resolvers y compartir el chequeo de soft-delete.
 */
type PadreResuelto =
  | { ok: true; cliente: string | null; clienteId: string | null; fecha: string | null }
  | { ok: false; status: number; body: unknown };

async function resolvePadre(
  supabase: ReturnType<typeof createClient>, facturaIdPadre: string | null,
): Promise<PadreResuelto> {
  if (!facturaIdPadre) return { ok: true, cliente: null, clienteId: null, fecha: null };
  const { data: padre } = await supabase
    .from("facturas")
    .select("cliente_id, cliente_nombre, fecha_emision, deleted_at")
    .eq("id", facturaIdPadre).maybeSingle();
  if (padre?.deleted_at) {
    return { ok: false, status: 404, body: { error: "factura_eliminada", message: "La factura fue eliminada." } };
  }
  return {
    ok: true,
    cliente: (padre?.cliente_nombre as string | null) ?? null,
    clienteId: (padre?.cliente_id as string | null) ?? null,
    fecha: (padre?.fecha_emision as string | null) ?? null,
  };
}

async function resolveFromNc(
  supabase: ReturnType<typeof createClient>, id: string,
): Promise<Resolved> {
  const { data: nc, error } = await supabase
    .from("factura_notas_credito")
    .select("facturapi_id, folio, serie, organization_id, fecha_emision, factura_id")
    .eq("id", id).maybeSingle();
  if (error || !nc) return { ok: false, status: 404, body: { error: "nota_credito_not_found" } };
  const ncId = nc.facturapi_id as string | null;
  if (!ncId) return { ok: false, status: 422, body: { error: "nc_no_timbrada" } };
  const serie = (nc.serie as string | null) ?? "";
  const folio = (nc.folio as string | null) ?? "";
  // Cliente/fecha se heredan de la factura padre si no vienen en la NC.
  const padre = await resolvePadre(supabase, nc.factura_id as string | null);
  if (!padre.ok) return padre;
  const fecha = (nc.fecha_emision as string | null) ?? padre.fecha;
  return {
    ok: true,
    data: {
      facturapiId: ncId,
      organizationId: nc.organization_id as string,
      tipoDoc: "NotaCredito",
      // Ola 4 · N39: al timbrar, `folio` ya se persiste como `<serie><folio>`
      // (v13.213.20), así que concatenar serie+folio duplicaba la serie
      // ("NCNC7.pdf"). Fallback defensivo para filas legacy sin folio.
      folioSerie: resolveFolioSerieNc(serie, folio),
      clienteId: padre.clienteId,
      cliente: padre.cliente,
      fecha,
    },
  };
}

async function resolveFromPago(
  supabase: ReturnType<typeof createClient>, id: string,
): Promise<Resolved> {
  const { data: pago, error } = await supabase
    .from("pagos_factura")
    .select("facturapi_rep_id, folio_rep, serie_rep, organization_id, factura_id, fecha_pago")
    .eq("id", id).maybeSingle();
  if (error || !pago) return { ok: false, status: 404, body: { error: "pago_not_found" } };
  const repId = pago.facturapi_rep_id as string | null;
  if (!repId) return { ok: false, status: 422, body: { error: "rep_no_timbrado" } };
  const folio = (pago.folio_rep as string | null) ?? "";
  const serie = (pago.serie_rep as string | null) ?? "";
  // Cliente se hereda de la factura padre; fecha usa fecha_pago del REP.
  const padre = await resolvePadre(supabase, pago.factura_id as string | null);
  if (!padre.ok) return padre;
  const cliente = padre.cliente;
  const clienteId = padre.clienteId;
  return {
    ok: true,
    data: {
      facturapiId: repId,
      organizationId: pago.organization_id as string,
      tipoDoc: "REP",
      folioSerie: `${serie}${folio}`,
      cliente,
      clienteId,
      fecha: (pago.fecha_pago as string | null) ?? null,
    },
  };
}

async function resolveFromFactura(
  supabase: ReturnType<typeof createClient>, id: string,
): Promise<Resolved> {
  const { data: factura, error } = await supabase
    .from("facturas")
    .select("facturapi_id, folio_fiscal, serie, organization_id, cliente_id, cliente_nombre, fecha_emision, numero, deleted_at")
    .eq("id", id).maybeSingle();
  if (error || !factura) return { ok: false, status: 404, body: { error: "factura_not_found" } };
  if (factura.deleted_at) return { ok: false, status: 404, body: { error: "factura_eliminada", message: "La factura fue eliminada." } };
  const fId = factura.facturapi_id as string | null;
  if (!fId) return { ok: false, status: 422, body: { error: "factura_no_timbrada" } };
  const numero = (factura.numero as string | null) ?? "";
  const serie = (factura.serie as string | null) ?? "";
  const folio = (factura.folio_fiscal as string | null) ?? "";
  const folioSerie = numero || `${serie}${folio}`;
  return {
    ok: true,
    data: {
      facturapiId: fId,
      organizationId: factura.organization_id as string,
      tipoDoc: "Factura",
      folioSerie,
      clienteId: (factura.cliente_id as string | null) ?? null,
      cliente: (factura.cliente_nombre as string | null) ?? null,
      fecha: (factura.fecha_emision as string | null) ?? null,
    },
  };
}

async function resolveTarget(
  supabase: ReturnType<typeof createClient>,
  body: ReqBody,
): Promise<Resolved> {
  if (body.nota_credito_id) return resolveFromNc(supabase, body.nota_credito_id);
  if (body.pago_id) return resolveFromPago(supabase, body.pago_id);
  if (body.factura_id) return resolveFromFactura(supabase, body.factura_id);
  return { ok: false, status: 400, body: { error: "missing_id", message: "factura_id, pago_id o nota_credito_id requerido" } };
}






Deno.serve(wrapEdgeHandler("facturapi-descargar", async (req) => {
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
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);

  const body = (await req.json().catch(() => ({}))) as ReqBody;
  const tipo = body.tipo;
  if (tipo !== "pdf" && tipo !== "xml") {
    return json({ error: "tipo_invalido", message: "tipo debe ser 'pdf' o 'xml'" }, 400);
  }

  // RTC-01: los genéricos por defecto de `createClient` difieren entre el
  // callsite y la firma del helper; se alinea el tipo sin cambiar el runtime.
  const target = await resolveTarget(supabase as Parameters<typeof resolveTarget>[0], body);
  if (!target.ok) return json(target.body, target.status);
  const autorizado =
    (await authorizeOrgRole(supabase, userData.user.id, target.data.organizationId, ROLES_DESCARGA_CFDI)) ||
    // El cliente del portal ve sus propios CFDI (no es miembro de la org).
    (await authorizePortalCliente(supabase, userData.user.id, target.data.clienteId, target.data.organizationId));
  if (!autorizado) {
    return json({ error: "forbidden" }, 403);
  }

  // La llave se resuelve con cliente SERVICE_ROLE (sin el JWT del usuario):
  // RLS de `facturapi_credenciales` sólo permite leer a admin/contador de la
  // org, así que el cliente user-scoped devolvía "org sin FacturApi" (412)
  // para clientes del portal y roles operativos. La autorización del
  // documento ya se validó arriba.
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const resolved = await resolveFacturapiKey(
    adminClient as unknown as Parameters<typeof resolveFacturapiKey>[0],
    target.data.organizationId,
  );
  if (!resolved.ok) {
    return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);
  }

  // FacturApi: tanto facturas como REP usan /invoices/<id>/{pdf,xml}
  const url = `${FACTURAPI_BASE}/invoices/${target.data.facturapiId}/${tipo}`;
  const fapiRes = await fetch(url, {
    headers: { Authorization: basicAuthHeader(resolved.data.apiKey) },
  });

  if (!fapiRes.ok) {
    const detail = await fapiRes.text().catch(() => "");
    const message = extractFacturapiMessage(detail, fapiRes.status);
    return json({ error: "facturapi_error", status: fapiRes.status, detail, message }, 502);
  }

  const contentType = tipo === "pdf" ? "application/pdf" : "application/xml";
  const ext: "pdf" | "xml" = tipo === "pdf" ? "pdf" : "xml";
  const filename = buildFilename({
    tipo: target.data.tipoDoc,
    folioSerie: target.data.folioSerie,
    cliente: target.data.cliente,
    fecha: target.data.fecha,
    ext,
  });

  return new Response(fapiRes.body, {
    status: 200,
    headers: {
      ...buildCors(req),
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Sin esto, fetch() en el navegador no puede leer Content-Disposition
      // por CORS y el cliente cae al filename por defecto `cfdi.pdf`.
      "Access-Control-Expose-Headers": "Content-Disposition",
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}));
