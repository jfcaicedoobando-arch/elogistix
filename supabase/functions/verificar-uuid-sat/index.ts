/**
 * verificar-uuid-sat — Consulta el estatus de un CFDI en el servicio público del SAT.
 *
 * Entrada:
 *   { factura_id: string, tipo?: "cxp" | "cxc" }
 *     - "cxp" (default): factura recibida de proveedor (`proveedor_facturas`)
 *     - "cxc" (α.1):     factura emitida al cliente (`facturas`)
 * Salida: { estatus: "Vigente"|"Cancelado"|"No Encontrado"|"Error", raw?: string }
 *
 * Consulta al Web Service público del SAT:
 *   https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc
 *
 * El expression es: ?re={RFC_EMISOR}&rr={RFC_RECEPTOR}&tt={TOTAL}&id={UUID}
 * v13.195.0
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { wrapEdgeHandler, captureEdgeException } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SAT_ENDPOINT = "https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc";

function json(cors: HeadersInit, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function buildSoapEnvelope(rfcEmisor: string, rfcReceptor: string, total: number, uuid: string) {
  // Formato oficial SAT — total con 6 decimales, string escape básico.
  const totalStr = total.toFixed(6);
  const expr = `?re=${rfcEmisor}&amp;rr=${rfcReceptor}&amp;tt=${totalStr}&amp;id=${uuid}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:Consulta>
      <tem:expresionImpresa>${expr}</tem:expresionImpresa>
    </tem:Consulta>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function parseSatResponse(xml: string): { estado: string; codigo: string } {
  const estado = /<[a-z]:?Estado>([^<]+)</i.exec(xml)?.[1] ?? "";
  const codigo = /<[a-z]:?CodigoEstatus>([^<]+)</i.exec(xml)?.[1] ?? "";
  return { estado: estado.trim(), codigo: codigo.trim() };
}

function mapEstatus(estado: string, codigo: string): "Vigente" | "Cancelado" | "No Encontrado" | "Error" {
  const e = estado.toLowerCase();
  if (e.includes("vigente")) return "Vigente";
  if (e.includes("cancelado")) return "Cancelado";
  if (codigo.includes("N - 202") || /no.*encontrad/i.test(estado)) return "No Encontrado";
  return "Error";
}

async function consultarSat(rfcEmisor: string, rfcReceptor: string, total: number, uuid: string) {
  const envelope = buildSoapEnvelope(rfcEmisor, rfcReceptor, total, uuid);
  const res = await fetch(SAT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": "http://tempuri.org/IConsultaCFDIService/Consulta",
    },
    body: envelope,
  });
  const xml = await res.text();
  if (!res.ok) return { estatus: "Error" as const, raw: xml.slice(0, 500) };
  const { estado, codigo } = parseSatResponse(xml);
  return { estatus: mapEstatus(estado, codigo), raw: `${codigo} | ${estado}` };
}

async function loadFactura(admin: ReturnType<typeof createClient>, facturaId: string) {
  const { data, error } = await admin
    .from("proveedor_facturas")
    .select("id, uuid_fiscal, rfc_proveedor, total, organization_id, organizations:organization_id(rfc)")
    .eq("id", facturaId)
    .maybeSingle();
  return { data, error };
}

async function authenticate(req: Request, cors: HeadersInit) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { error: json(cors, { error: "unauthorized" }, 401) };
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { error: json(cors, { error: "unauthorized" }, 401) };
  return { user: data.user };
}

async function parseBody(req: Request, cors: HeadersInit): Promise<{ id?: string; error?: Response }> {
  let body: { factura_id?: string };
  try { body = await req.json(); } catch { return { error: json(cors, { error: "invalid_json" }, 400) }; }
  if (!body.factura_id) return { error: json(cors, { error: "factura_id_required" }, 400) };
  return { id: body.factura_id };
}

Deno.serve(wrapEdgeHandler("verificar-uuid-sat", async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  if (req.method !== "POST") return json(cors, { error: "method_not_allowed" }, 405);

  const auth = await authenticate(req, cors);
  if (auth.error) return auth.error;

  const parsed = await parseBody(req, cors);
  if (parsed.error) return parsed.error;
  const facturaId = parsed.id!;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: fact, error: fErr } = await loadFactura(admin, facturaId);
  if (fErr || !fact) return json(cors, { error: "factura_not_found", detail: fErr?.message }, 404);
  if (!fact.uuid_fiscal) return json(cors, { error: "uuid_fiscal_missing" }, 422);
  if (!fact.rfc_proveedor) return json(cors, { error: "rfc_proveedor_missing" }, 422);
  const rfcReceptor = (fact as { organizations?: { rfc?: string } | null }).organizations?.rfc ?? "";
  if (!rfcReceptor) return json(cors, { error: "rfc_receptor_missing" }, 422);

  let result: { estatus: string; raw: string };
  try {
    result = await consultarSat(
      fact.rfc_proveedor.trim().toUpperCase(),
      rfcReceptor.trim().toUpperCase(),
      Number(fact.total),
      fact.uuid_fiscal.trim().toUpperCase(),
    );
  } catch (e) {
    await captureEdgeException(e, { fn: "verificar-uuid-sat", extra: { factura_id: facturaId } });
    return json(cors, { error: "sat_unreachable", detail: (e as Error).message }, 502);
  }

  const { error: uErr } = await admin
    .from("proveedor_facturas")
    .update({
      uuid_verificado: result.estatus === "Vigente",
      uuid_estatus_sat: result.estatus,
      uuid_verificado_fecha: new Date().toISOString(),
    })
    .eq("id", facturaId);
  if (uErr) return json(cors, { error: "update_failed", detail: uErr.message }, 500);

  return json(cors, { estatus: result.estatus, raw: result.raw });
}));
