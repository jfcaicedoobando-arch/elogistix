/**
 * facturapi-consultar — Consulta en vivo el estado de una factura en FacturApi
 * (`GET /v2/invoices/{id}`) y reconcilia la BD local si detecta divergencia.
 *
 * Sólo lectura desde el punto de vista del usuario: no cancela ni timbra.
 * Devuelve un objeto con lo que ve FacturApi (`status`, `cancellation_status`,
 * `canceled_at`, `related_documents`) + lo que tenemos en BD + un flag
 * `divergencia` para que la UI resalte diferencias.
 *
 * Entrada: { factura_id: string }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";
import { getFacturapiClient } from "../_shared/facturapiClient.ts";
import { authorizeOrgRole, ROLES_CONSULTA_FISCAL } from "../_shared/auth.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";

interface FapiInvoiceStatus {
  status?: string;
  cancellation_status?: string;
}
interface FacturaPendiente {
  id: string;
  organization_id: string;
  facturapi_id: string;
  cancellation_status: string;
  sustituida_por: string | null;
}
interface ResolvedPatch {
  outcome: "accepted" | "rejected" | "expired" | "transition" | "no_change";
  patch: Record<string, unknown>;
}

/**
 * Copia local de la lógica de `facturapi-reconciliar-cancelaciones/reconcile.ts`.
 * Supabase bundle-only permite archivos del mismo folder, así que se duplica aquí
 * para no depender de un import cross-folder que rompería el deploy.
 */
function resolveNextAction(remote: FapiInvoiceStatus, local: FacturaPendiente, nowIso: string): ResolvedPatch {
  const cs = (remote.cancellation_status ?? "").toLowerCase();
  // Ola 4 · N18: "aceptada" se evalúa antes del guard de igualdad.
  if (cs === "accepted" || remote.status === "canceled") {
    return {
      outcome: "accepted",
      patch: {
        estado: local.sustituida_por ? "Sustituida" : "Cancelada",
        cancellation_status: "accepted",
        cancelado_en: nowIso,
      },
    };
  }
  if (cs === local.cancellation_status) return { outcome: "no_change", patch: {} };
  if (cs === "rejected" || cs === "expired") {
    return {
      outcome: cs,
      patch: { cancellation_status: cs, cancelacion_solicitada_en: null, cancelacion_vence_en: null },
    };
  }
  if (cs && cs !== local.cancellation_status) {
    return { outcome: "transition", patch: { cancellation_status: cs } };
  }
  return { outcome: "no_change", patch: {} };
}


const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface FapiInvoiceRemote extends FapiInvoiceStatus {
  id?: string;
  uuid?: string;
  folio_number?: number;
  series?: string;
  canceled_at?: string | null;
  related_documents?: Array<{
    relationship?: string;
    documents?: Array<string | { uuid?: string; folio_number?: number; series?: string; total?: number }>;
  }>;
}

interface LocalFactura {
  id: string;
  facturapi_id: string;
  organization_id: string;
  estado: string | null;
  cancellation_status: string | null;
  uuid_fiscal: string | null;
  sustituida_por: string | null;
}

type SBClient = ReturnType<typeof createClient>;

async function loadFactura(supabase: SBClient, facturaId: string): Promise<
  { ok: true; factura: LocalFactura } | { ok: false; res: Response }
> {
  const { data, error } = await supabase
    .from("facturas")
    .select("id, facturapi_id, organization_id, estado, cancellation_status, uuid_fiscal, sustituida_por")
    .eq("id", facturaId)
    .maybeSingle();
  if (error || !data) return { ok: false, res: jsonResponse({ error: "factura_not_found" }, 404) };
  if (!data.facturapi_id) return { ok: false, res: jsonResponse({ error: "no_timbrada" }, 409) };
  return { ok: true, factura: data as LocalFactura };
}

async function fetchRemote(supabase: SBClient, factura: LocalFactura): Promise<
  { ok: true; remote: FapiInvoiceRemote } | { ok: false; res: Response }
> {
  const resolved = await getFacturapiClient(supabase, factura.organization_id);
  if (!resolved.ok) {
    return { ok: false, res: jsonResponse({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status) };
  }
  try {
    const client = resolved.data.client as { invoices: { retrieve: (id: string) => Promise<unknown> } };
    const remote = await client.invoices.retrieve(factura.facturapi_id) as FapiInvoiceRemote;
    return { ok: true, remote };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, res: jsonResponse({ error: "facturapi_error", message: detail }, 502) };
  }
}

function computeDivergencias(remote: FapiInvoiceRemote, factura: LocalFactura): string[] {
  const remoteStatus = (remote.status ?? "").toLowerCase();
  const remoteCancellation = (remote.cancellation_status ?? "none").toLowerCase();
  const localCancellation = (factura.cancellation_status ?? "none").toLowerCase();
  const localEstado = (factura.estado ?? "").toLowerCase();
  const out: string[] = [];
  if (remoteCancellation !== localCancellation) {
    out.push(`cancellation_status: BD='${localCancellation}' ≠ FacturApi='${remoteCancellation}'`);
  }
  if (remoteStatus === "canceled" && localEstado !== "cancelada" && localEstado !== "sustituida") {
    out.push(`status: BD='${localEstado}' ≠ FacturApi='${remoteStatus}'`);
  }
  return out;
}

async function reconciliarSiAplica(
  supabase: SBClient,
  factura: LocalFactura,
  remote: FapiInvoiceRemote,
  divergencias: string[],
  user: { id: string; email?: string },
): Promise<boolean> {
  if (divergencias.length === 0) return false;
  const pendiente: FacturaPendiente = {
    id: factura.id,
    organization_id: factura.organization_id,
    facturapi_id: factura.facturapi_id,
    cancellation_status: (factura.cancellation_status ?? "none").toLowerCase(),
    sustituida_por: factura.sustituida_por ?? null,
  };
  const decision = resolveNextAction(remote, pendiente, new Date().toISOString());
  if (decision.outcome === "no_change" || Object.keys(decision.patch).length === 0) return false;
  const { error: updErr } = await supabase.from("facturas").update(decision.patch).eq("id", factura.id);
  if (updErr) return false;
  await registrarBitacoraEdge(supabase, {
    organizationId: factura.organization_id,
    usuarioId: user.id,
    usuarioEmail: user.email,
    modulo: "facturacion",
    accion: "facturapi_consulta_reconciliada",
    entidadId: factura.id,
    detalles: { outcome: decision.outcome, patch: decision.patch, divergencias },
  });
  return true;
}

function flattenRelated(remote: FapiInvoiceRemote) {
  return (remote.related_documents ?? []).flatMap((rel) => {
    const docs = rel.documents ?? [];
    return docs.map((d) => (typeof d === "string"
      ? { relationship: rel.relationship ?? null, id: d }
      : {
          relationship: rel.relationship ?? null,
          uuid: d.uuid ?? null,
          folio: d.folio_number ?? null,
          serie: d.series ?? null,
          total: d.total ?? null,
        }));
  });
}

async function handle(req: Request): Promise<Response> {
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

  const body = (await req.json().catch(() => ({}))) as { factura_id?: string };
  if (!body.factura_id) return jsonResponse({ error: "factura_id_required" }, 400);

  const loaded = await loadFactura(supabase, body.factura_id);
  if (!loaded.ok) return loaded.res;
  const factura = loaded.factura;

  if (!(await authorizeOrgRole(supabase, userData.user.id, factura.organization_id, ROLES_CONSULTA_FISCAL))) {
    return jsonResponse({ error: "forbidden" }, 403);
  }

  const fetched = await fetchRemote(supabase, factura);
  if (!fetched.ok) return fetched.res;
  const remote = fetched.remote;

  const divergencias = computeDivergencias(remote, factura);
  const reconciliada = await reconciliarSiAplica(supabase, factura, remote, divergencias, {
    id: userData.user.id,
    email: userData.user.email,
  });

  return jsonResponse(buildResponse(factura, remote, divergencias, reconciliada));
}

function buildResponse(
  factura: LocalFactura,
  remote: FapiInvoiceRemote,
  divergencias: string[],
  reconciliada: boolean,
) {
  return {
    ok: true,
    reconciliada,
    divergencias,
    remoto: {
      status: (remote.status ?? "").toLowerCase() || null,
      cancellation_status: (remote.cancellation_status ?? "none").toLowerCase(),
      canceled_at: remote.canceled_at ?? null,
      uuid: remote.uuid ?? null,
      folio: remote.folio_number ?? null,
      serie: remote.series ?? null,
      related_documents: flattenRelated(remote),
    },
    local: {
      estado: factura.estado,
      cancellation_status: (factura.cancellation_status ?? "none").toLowerCase(),
      uuid_fiscal: factura.uuid_fiscal ?? null,
    },
  };
}

Deno.serve(wrapEdgeHandler("facturapi-consultar", handle));


