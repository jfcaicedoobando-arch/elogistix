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
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { resolveFacturapiKey, FACTURAPI_BASE, basicAuthHeader } from "../_shared/facturapiAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ReqBody {
  tipo?: "pdf" | "xml";
  factura_id?: string;
  pago_id?: string;
}

interface ResolvedTarget {
  facturapiId: string;
  organizationId: string;
  filename: string;
}

async function resolveTarget(
  supabase: ReturnType<typeof createClient>,
  body: ReqBody,
): Promise<{ ok: true; data: ResolvedTarget } | { ok: false; status: number; body: unknown }> {
  if (body.pago_id) {
    const { data: pago, error } = await supabase
      .from("pagos_factura")
      .select("facturapi_rep_id, folio_rep, serie_rep, organization_id, factura_id")
      .eq("id", body.pago_id)
      .maybeSingle();
    if (error || !pago) return { ok: false, status: 404, body: { error: "pago_not_found" } };
    const repId = pago.facturapi_rep_id as string | null;
    if (!repId) return { ok: false, status: 422, body: { error: "rep_no_timbrado" } };
    const folio = pago.folio_rep ?? "REP";
    const serie = pago.serie_rep ?? "";
    return {
      ok: true,
      data: {
        facturapiId: repId,
        organizationId: pago.organization_id as string,
        filename: `REP-${serie}${folio}`,
      },
    };
  }
  if (body.factura_id) {
    const { data: factura, error } = await supabase
      .from("facturas")
      .select("facturapi_id, folio_fiscal, serie, organization_id")
      .eq("id", body.factura_id)
      .maybeSingle();
    if (error || !factura) return { ok: false, status: 404, body: { error: "factura_not_found" } };
    const fId = factura.facturapi_id as string | null;
    if (!fId) return { ok: false, status: 422, body: { error: "factura_no_timbrada" } };
    const folio = factura.folio_fiscal ?? "S/F";
    const serie = factura.serie ?? "";
    return {
      ok: true,
      data: {
        facturapiId: fId,
        organizationId: factura.organization_id as string,
        filename: `${serie}${folio}`,
      },
    };
  }
  return { ok: false, status: 400, body: { error: "missing_id", message: "factura_id o pago_id requerido" } };
}

Deno.serve(wrapEdgeHandler("facturapi-descargar", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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

  const target = await resolveTarget(supabase, body);
  if (!target.ok) return json(target.body, target.status);

  const resolved = await resolveFacturapiKey(supabase, target.data.organizationId);
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
    return json({ error: "facturapi_error", status: fapiRes.status, detail }, 502);
  }

  const contentType = tipo === "pdf" ? "application/pdf" : "application/xml";
  const ext = tipo === "pdf" ? "pdf" : "xml";
  const filename = `${target.data.filename}.${ext}`;

  return new Response(fapiRes.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}));
