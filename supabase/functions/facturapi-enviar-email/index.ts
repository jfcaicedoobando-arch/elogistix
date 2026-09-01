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
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { resolveFacturapiKey, FACTURAPI_BASE, basicAuthHeader } from "../_shared/facturapiAuth.ts";
import { authorizeOrgRole, ROLES_CONSULTA_FISCAL } from "../_shared/auth.ts";
import { resolverDestinatarioAutorizado } from "./destinatarioAutorizado.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse, makeJson } from "../_shared/response.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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



Deno.serve(wrapEdgeHandler("facturapi-enviar-email", async (req) => {
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

  const target = await resolveTarget(supabase, body);
  if (!target.ok) return json(target.body, target.status);
  if (!(await authorizeOrgRole(supabase, userData.user.id, target.data.organizationId, ROLES_CONSULTA_FISCAL))) {
    return json({ error: "forbidden" }, 403);
  }

  const destinatario = await resolverDestinatarioAutorizado({
    supabase,
    json,
    userId: userData.user.id,
    userEmail: userData.user.email,
    organizationId: target.data.organizationId,
    clienteId: target.data.clienteId || null,
    emailSolicitado: body.email,
  });
  if (destinatario instanceof Response) return destinatario;
  const { email, emailDistintoSugerido } = destinatario;

  // La llave se resuelve con cliente SERVICE_ROLE (sin el JWT del usuario):
  // RLS de `facturapi_credenciales` sólo permite leer a admin/contador de la
  // org, así que el cliente user-scoped devolvía "org sin FacturApi" (412)
  // para clientes del portal y roles operativos. La autorización del
  // documento ya se validó arriba.
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const resolved = await resolveFacturapiKey(adminClient, target.data.organizationId);
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
      detalles: {
        email_enviado: email,
        email_distinto_sugerido: emailDistintoSugerido,
        tipo: target.data.tipo,
        status: fapiRes.status,
        detail,
      },
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
    detalles: {
      email_enviado: email,
      email_distinto_sugerido: emailDistintoSugerido,
      tipo: target.data.tipo,
    },
  });

  return json({ ok: true, enviado_a: email });
}));
