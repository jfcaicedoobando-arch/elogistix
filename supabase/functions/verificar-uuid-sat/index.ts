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
import { jsonResponse as _jsonResponse } from "../_shared/response.ts";
import { authorizeOrgMembership } from "../_shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SAT_ENDPOINT = "https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc";

// Alias local con firma (cors, body, status) para conservar los callsites de este handler.
const json = (cors: Record<string, string>, body: unknown, status = 200): Response =>
  _jsonResponse(body, status, cors);

/**
 * v13.320.62 — Escapa un valor antes de meterlo en el sobre SOAP.
 * Sin esto, un RFC con `&` (ej. `AL&0807074L5`) rompe el XML del request
 * y el SAT responde con un cuerpo que no podemos interpretar.
 * OJO: los separadores `&amp;` de la expresión NO pasan por aquí.
 */
function escapeXmlValue(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildSoapEnvelope(rfcEmisor: string, rfcReceptor: string, total: number, uuid: string) {
  // Formato oficial SAT — total con 6 decimales, string escape básico.
  const totalStr = total.toFixed(6);
  const re = escapeXmlValue(rfcEmisor);
  const rr = escapeXmlValue(rfcReceptor);
  const id = escapeXmlValue(uuid);
  const expr = `?re=${re}&amp;rr=${rr}&amp;tt=${totalStr}&amp;id=${id}`;
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

/**
 * v13.320.62 — el regex anterior (`<[a-z]:?Estado>`) exigía un prefijo de
 * namespace de exactamente una letra: `<Estado>` o `<ns1:Estado>` no
 * matcheaban y el resultado caía en "Error" sin razón real.
 */
function parseSatResponse(xml: string): { estado: string; codigo: string } {
  const estado = /<(?:[\w.-]+:)?Estado>([^<]*)</i.exec(xml)?.[1] ?? "";
  const codigo = /<(?:[\w.-]+:)?CodigoEstatus>([^<]*)</i.exec(xml)?.[1] ?? "";
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

/**
 * v13.320.62 — Defensa contra datos históricos: RFCs importados de CFDI antes
 * del fix del parser quedaron con entidades XML (`AL&amp;0807074L5`).
 * Normalizamos aquí también para no depender solo del backfill.
 */
function normalizarRfc(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim()
    .toUpperCase();
}

type Tipo = "cxp" | "cxc" | "cxp_nc";

interface CfdiParaVerificar {
  uuid_fiscal: string | null;
  rfc_emisor: string;
  rfc_receptor: string;
  total: number;
  organization_id: string | null;
}

async function fetchOrgRfc(admin: ReturnType<typeof createClient>, orgId: string | null): Promise<string> {
  if (!orgId) return "";
  const { data } = await admin.from("organizations").select("rfc").eq("id", orgId).maybeSingle();
  return normalizarRfc((data as { rfc?: string } | null)?.rfc);
}

async function loadFacturaCxp(admin: ReturnType<typeof createClient>, facturaId: string): Promise<{ data: CfdiParaVerificar | null; error: unknown }> {
  const { data, error } = await admin
    .from("proveedor_facturas")
    .select("id, uuid_fiscal, rfc_proveedor, total, organization_id")
    .eq("id", facturaId)
    .maybeSingle();
  if (error || !data) return { data: null, error };
  const row = data as { uuid_fiscal: string | null; rfc_proveedor: string | null; total: number; organization_id: string | null };
  const rfcReceptor = await fetchOrgRfc(admin, row.organization_id);
  return {
    data: {
      uuid_fiscal: row.uuid_fiscal,
      rfc_emisor: normalizarRfc(row.rfc_proveedor),
      rfc_receptor: rfcReceptor,
      total: Number(row.total ?? 0),
      organization_id: row.organization_id,
    },
    error: null,
  };
}

async function loadFacturaCxc(admin: ReturnType<typeof createClient>, facturaId: string): Promise<{ data: CfdiParaVerificar | null; error: unknown }> {
  // α.1 — CFDI emitido: emisor = org, receptor = cliente (por rfc_cliente).
  const { data, error } = await admin
    .from("facturas")
    .select("id, uuid_fiscal, rfc_cliente, total, organization_id")
    .eq("id", facturaId)
    .maybeSingle();
  if (error || !data) return { data: null, error };
  const row = data as { uuid_fiscal: string | null; rfc_cliente: string | null; total: number; organization_id: string | null };
  const rfcEmisor = await fetchOrgRfc(admin, row.organization_id);
  return {
    data: {
      uuid_fiscal: row.uuid_fiscal,
      rfc_emisor: rfcEmisor,
      rfc_receptor: normalizarRfc(row.rfc_cliente),
      total: Number(row.total ?? 0),
      organization_id: row.organization_id,
    },
    error: null,
  };
}

async function loadNotaCreditoCxp(admin: ReturnType<typeof createClient>, ncId: string): Promise<{ data: CfdiParaVerificar | null; error: unknown }> {
  const { data, error } = await admin
    .from("proveedor_notas_credito")
    .select("id, uuid_fiscal, monto, organization_id, proveedor_factura_id, proveedor_facturas:proveedor_factura_id (rfc_proveedor)")
    .eq("id", ncId)
    .maybeSingle();
  if (error || !data) return { data: null, error };
  const row = data as {
    uuid_fiscal: string | null;
    monto: number;
    organization_id: string | null;
    proveedor_facturas?: { rfc_proveedor?: string | null } | null;
  };
  const rfcReceptor = await fetchOrgRfc(admin, row.organization_id);
  return {
    data: {
      uuid_fiscal: row.uuid_fiscal,
      rfc_emisor: normalizarRfc(row.proveedor_facturas?.rfc_proveedor),
      rfc_receptor: rfcReceptor,
      total: Number(row.monto ?? 0),
      organization_id: row.organization_id,
    },
    error: null,
  };
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

function parseTipo(raw?: string): Tipo {
  if (raw === "cxc") return "cxc";
  if (raw === "cxp_nc") return "cxp_nc";
  return "cxp";
}

async function parseBody(req: Request, cors: HeadersInit): Promise<{ id?: string; tipo?: Tipo; error?: Response }> {
  let body: { factura_id?: string; nc_id?: string; tipo?: string };
  try { body = await req.json(); } catch { return { error: json(cors, { error: "invalid_json" }, 400) }; }
  if (body.nc_id && body.tipo === "cxp_nc") return { id: body.nc_id, tipo: "cxp_nc" };
  if (!body.factura_id) return { error: json(cors, { error: "factura_id_required" }, 400) };
  const tipo: Tipo = parseTipo(body.tipo);
  return { id: body.factura_id, tipo };
}

async function processVerification(
  cors: HeadersInit,
  userId: string,
  id: string,
  tipo: Tipo,
): Promise<Response> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let fact: CfdiParaVerificar | null = null;
  let fErr: unknown = null;
  if (tipo === "cxc") {
    ({ data: fact, error: fErr } = await loadFacturaCxc(admin, id));
  } else if (tipo === "cxp_nc") {
    ({ data: fact, error: fErr } = await loadNotaCreditoCxp(admin, id));
  } else {
    ({ data: fact, error: fErr } = await loadFacturaCxp(admin, id));
  }

  if (fErr || !fact) return json(cors, { error: "factura_not_found", detail: (fErr as { message?: string })?.message }, 404);
  if (!fact.organization_id) return json(cors, { error: "factura_sin_organizacion" }, 422);
  const allowed = await authorizeOrgMembership(admin, userId, fact.organization_id);
  if (!allowed) return json(cors, { error: "forbidden" }, 403);
  if (!fact.uuid_fiscal) return json(cors, { error: "uuid_fiscal_missing" }, 422);
  if (!fact.rfc_emisor) return json(cors, { error: "rfc_emisor_missing" }, 422);
  if (!fact.rfc_receptor) return json(cors, { error: "rfc_receptor_missing" }, 422);

  let result: { estatus: string; raw: string };
  try {
    result = await consultarSat(
      fact.rfc_emisor,
      fact.rfc_receptor,
      fact.total,
      fact.uuid_fiscal.trim().toUpperCase(),
    );
  } catch (e) {
    await captureEdgeException(e, { fn: "verificar-uuid-sat", extra: { id, tipo } });
    return json(cors, { error: "sat_unreachable", detail: (e as Error).message }, 502);
  }

  const targetTable = tipo === "cxc" ? "facturas" : tipo === "cxp_nc" ? "proveedor_notas_credito" : "proveedor_facturas";
  const { error: uErr } = await admin
    .from(targetTable)
    .update({
      uuid_verificado: result.estatus === "Vigente",
      uuid_estatus_sat: result.estatus,
      uuid_verificado_fecha: new Date().toISOString(),
    })
    .eq("id", id);
  if (uErr) return json(cors, { error: "update_failed", detail: uErr.message }, 500);

  return json(cors, { estatus: result.estatus, raw: result.raw });
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

  return processVerification(cors, auth.user!.id, parsed.id!, parsed.tipo!);
}));
