/**
 * facturapi-enviar-email — Envía el CFDI (factura o REP) por email al cliente
 * a través de FacturApi. FacturApi adjunta el PDF + XML automáticamente.
 *
 * Entrada (POST):
 *   { factura_id?: string, pago_id?: string, email?: string }
 *
 * Salida: { ok: true, enviado_a: string } o error normalizado.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { resolveFacturapiKey, FACTURAPI_BASE, basicAuthHeader } from "../_shared/facturapiAuth.ts";
import { authorizeOrgMembership } from "../_shared/auth.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ReqBody {
  factura_id?: string;
  pago_id?: string;
  nota_credito_id?: string;
  email?: string;
}

interface Target {
  facturapiId: string;
  organizationId: string;
  clienteId: string;
  tipo: "factura" | "rep" | "nota_credito";
  entidadId: string;
}

type SbClient = ReturnType<typeof createClient>;

type ResolvedT =
  | { ok: true; data: Target }
  | { ok: false; status: number; body: unknown };

async function resolveFromNc(supabase: SbClient, id: string): Promise<ResolvedT> {
  const { data: nc, error } = await supabase
    .from("factura_notas_credito")
    .select("facturapi_id, organization_id, factura_id")
    .eq("id", id).maybeSingle();
  if (error || !nc) return { ok: false, status: 404, body: { error: "nota_credito_not_found" } };
  const ncId = nc.facturapi_id as string | null;
  if (!ncId) return { ok: false, status: 422, body: { error: "nc_no_timbrada" } };
  const { data: fact } = await supabase
    .from("facturas").select("cliente_id").eq("id", nc.factura_id as string).maybeSingle();
  return { ok: true, data: {
    facturapiId: ncId, organizationId: nc.organization_id as string,
    clienteId: (fact?.cliente_id as string) ?? "", tipo: "nota_credito", entidadId: id,
  } };
}

async function resolveFromPago(supabase: SbClient, id: string): Promise<ResolvedT> {
  const { data: pago, error } = await supabase
    .from("pagos_factura")
    .select("facturapi_rep_id, organization_id, factura_id")
    .eq("id", id).maybeSingle();
  if (error || !pago) return { ok: false, status: 404, body: { error: "pago_not_found" } };
  const repId = pago.facturapi_rep_id as string | null;
  if (!repId) return { ok: false, status: 422, body: { error: "rep_no_timbrado" } };
  const { data: fact } = await supabase
    .from("facturas").select("cliente_id").eq("id", pago.factura_id as string).maybeSingle();
  return { ok: true, data: {
    facturapiId: repId, organizationId: pago.organization_id as string,
    clienteId: (fact?.cliente_id as string) ?? "", tipo: "rep", entidadId: id,
  } };
}

async function resolveFromFactura(supabase: SbClient, id: string): Promise<ResolvedT> {
  const { data: factura, error } = await supabase
    .from("facturas")
    .select("facturapi_id, organization_id, cliente_id")
    .eq("id", id).maybeSingle();
  if (error || !factura) return { ok: false, status: 404, body: { error: "factura_not_found" } };
  const fId = factura.facturapi_id as string | null;
  if (!fId) return { ok: false, status: 422, body: { error: "factura_no_timbrada" } };
  return { ok: true, data: {
    facturapiId: fId, organizationId: factura.organization_id as string,
    clienteId: factura.cliente_id as string, tipo: "factura", entidadId: id,
  } };
}

async function resolveTarget(supabase: SbClient, body: ReqBody): Promise<ResolvedT> {
  if (body.nota_credito_id) return resolveFromNc(supabase, body.nota_credito_id);
  if (body.pago_id) return resolveFromPago(supabase, body.pago_id);
  if (body.factura_id) return resolveFromFactura(supabase, body.factura_id);
  return { ok: false, status: 400, body: { error: "missing_id", message: "factura_id, pago_id o nota_credito_id requerido" } };
}



async function resolveEmail(
  supabase: SbClient,
  clienteId: string,
  override: string | undefined,
): Promise<string | null> {
  if (override && override.includes("@")) return override.trim();
  if (!clienteId) return null;
  const { data: contacto } = await supabase
    .from("contactos_cliente")
    .select("email")
    .eq("cliente_id", clienteId)
    .eq("es_principal", true)
    .maybeSingle();
  const emailContacto = (contacto?.email as string | null) ?? null;
  if (emailContacto) return emailContacto;
  const { data: cliente } = await supabase
    .from("clientes")
    .select("email")
    .eq("id", clienteId)
    .maybeSingle();
  return (cliente?.email as string | null) ?? null;
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

Deno.serve(wrapEdgeHandler("facturapi-enviar-email", async (req) => {
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

  const target = await resolveTarget(supabase, body);
  if (!target.ok) return json(target.body, target.status);

  const email = await resolveEmail(supabase, target.data.clienteId, body.email);
  if (!email) return json({ error: "missing_email", message: "El cliente no tiene email registrado." }, 422);
  if (!isValidEmail(email)) return json({ error: "invalid_email", message: "Email inválido." }, 400);

  const resolved = await resolveFacturapiKey(supabase, target.data.organizationId);
  if (!resolved.ok) return json({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status);

  // FacturApi: tanto facturas como REP usan /invoices/<id>/email
  const url = `${FACTURAPI_BASE}/invoices/${target.data.facturapiId}/email`;
  const fapiRes = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(resolved.data.apiKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: [email] }),
  });

  if (!fapiRes.ok) {
    const detail = await fapiRes.text().catch(() => "");
    await registrarBitacoraEdge(supabase, {
      organizationId: target.data.organizationId,
      usuarioId: userData.user.id,
      usuarioEmail: userData.user.email,
      modulo: "facturacion",
      accion: "cfdi_envio_failed",
      entidadId: target.data.entidadId,
      detalles: { email, tipo: target.data.tipo, status: fapiRes.status, detail },
    });
    const message = fapiRes.status === 404
      ? "CFDI no encontrado en FacturApi (puede estar cancelado)."
      : `FacturApi rechazó el envío (${fapiRes.status}).`;
    return json({ error: "facturapi_error", status: fapiRes.status, detail, message }, 502);
  }

  await registrarBitacoraEdge(supabase, {
    organizationId: target.data.organizationId,
    usuarioId: userData.user.id,
    usuarioEmail: userData.user.email,
    modulo: "facturacion",
    accion: "cfdi_enviado",
    entidadId: target.data.entidadId,
    detalles: { email, tipo: target.data.tipo },
  });

  return json({ ok: true, enviado_a: email });
}));
