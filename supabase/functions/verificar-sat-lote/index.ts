/**
 * verificar-sat-lote — Barrido masivo del estatus de CFDI en el SAT para las
 * facturas de proveedor nacional de una organización.
 *
 * Entrada (POST, JSON opcional):
 *   {
 *     limite?: number,               // default 200, máx 500
 *     solo_sin_verificar?: boolean,  // default false (revisa también las ya verificadas)
 *     organization_id?: string       // default: la organización del usuario
 *   }
 *
 * Salida:
 *   {
 *     total, procesadas,
 *     resumen: { Vigente, Cancelado, "No Encontrado", "No verificable", Error, omitidas },
 *     canceladas: [{ id, folio_interno, folio_proveedor, proveedor_nombre, total, uuid_fiscal }],
 *     fallos: [{ id, motivo }]
 *   }
 *
 * Actualiza únicamente `uuid_verificado`, `uuid_estatus_sat` y
 * `uuid_verificado_fecha`. Nunca cambia el estado de la factura ni sus importes.
 *
 * v13.429.0
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { wrapEdgeHandler, captureEdgeException } from "../_shared/sentry.ts";
import { jsonResponse } from "../_shared/response.ts";
import { authenticate, authorizeOrgMembership } from "../_shared/auth.ts";
import { consultarSat, normalizarRfc, type EstatusSat } from "../_shared/satConsulta.ts";

const PAUSA_MS = 350;
const LIMITE_DEFAULT = 200;
const LIMITE_MAX = 500;

interface FilaFactura {
  id: string;
  uuid_fiscal: string | null;
  rfc_proveedor: string | null;
  total: number | null;
  folio_interno: string | null;
  folio_proveedor: string | null;
  proveedor_nombre: string | null;
  estado: string | null;
}

interface Cancelada {
  id: string;
  folio_interno: string | null;
  folio_proveedor: string | null;
  proveedor_nombre: string | null;
  total: number | null;
  uuid_fiscal: string | null;
}

type Resumen = Record<EstatusSat | "omitidas", number>;

const resumenVacio = (): Resumen => ({
  Vigente: 0,
  Cancelado: 0,
  "No Encontrado": 0,
  "No verificable": 0,
  Error: 0,
  omitidas: 0,
});

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function orgDelUsuario(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return (data as { organization_id?: string } | null)?.organization_id ?? null;
}

async function rfcOrganizacion(admin: SupabaseClient, orgId: string): Promise<string> {
  const { data } = await admin.from("organizations").select("rfc").eq("id", orgId).maybeSingle();
  return normalizarRfc((data as { rfc?: string } | null)?.rfc);
}

async function cargarFacturas(
  admin: SupabaseClient,
  orgId: string,
  soloSinVerificar: boolean,
  limite: number,
): Promise<FilaFactura[]> {
  let q = admin
    .from("proveedor_facturas")
    .select(
      "id, uuid_fiscal, rfc_proveedor, total, folio_interno, folio_proveedor, proveedor_nombre, estado, proveedores!inner(origen_proveedor)",
    )
    .eq("organization_id", orgId)
    .not("uuid_fiscal", "is", null)
    .neq("proveedores.origen_proveedor", "Extranjero")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (soloSinVerificar) q = q.is("uuid_estatus_sat", null);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as FilaFactura[];
}

interface Salida {
  total: number;
  procesadas: number;
  resumen: Resumen;
  canceladas: Cancelada[];
  fallos: { id: string; motivo: string }[];
}

async function procesarFactura(
  admin: SupabaseClient,
  f: FilaFactura,
  rfcReceptor: string,
  out: Salida,
): Promise<void> {
  const rfcEmisor = normalizarRfc(f.rfc_proveedor);
  const uuid = (f.uuid_fiscal ?? "").trim().toUpperCase();
  if (!rfcEmisor || !uuid) {
    out.resumen.omitidas += 1;
    out.fallos.push({ id: f.id, motivo: "Falta RFC del proveedor o UUID" });
    return;
  }

  const res = await consultarSat(rfcEmisor, rfcReceptor, Number(f.total ?? 0), uuid);
  out.resumen[res.estatus] += 1;
  out.procesadas += 1;

  if (res.estatus === "Cancelado") {
    out.canceladas.push({
      id: f.id,
      folio_interno: f.folio_interno,
      folio_proveedor: f.folio_proveedor,
      proveedor_nombre: f.proveedor_nombre,
      total: f.total,
      uuid_fiscal: f.uuid_fiscal,
    });
  }

  const { error } = await admin
    .from("proveedor_facturas")
    .update({
      uuid_verificado: res.estatus === "Vigente",
      uuid_estatus_sat: res.estatus,
      uuid_verificado_fecha: new Date().toISOString(),
    })
    .eq("id", f.id);
  if (error) out.fallos.push({ id: f.id, motivo: `No se pudo guardar: ${error.message}` });
}

function parseLimite(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return LIMITE_DEFAULT;
  return Math.min(Math.floor(n), LIMITE_MAX);
}

Deno.serve(wrapEdgeHandler("verificar-sat-lote", async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, cors);

  let ctx: Awaited<ReturnType<typeof authenticate>>;
  try {
    ctx = await authenticate(req);
  } catch {
    return jsonResponse({ error: "unauthorized" }, 401, cors);
  }
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  let body: { limite?: unknown; solo_sin_verificar?: boolean; organization_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const orgId = body.organization_id ?? (await orgDelUsuario(admin, ctx.userId));
  if (!orgId) return jsonResponse({ error: "organizacion_no_encontrada" }, 422, cors);
  const permitido = await authorizeOrgMembership(admin, ctx.userId, orgId);
  if (!permitido) return jsonResponse({ error: "forbidden" }, 403, cors);

  const rfcReceptor = await rfcOrganizacion(admin, orgId);
  if (!rfcReceptor) return jsonResponse({ error: "rfc_organizacion_faltante" }, 422, cors);

  let facturas: FilaFactura[];
  try {
    facturas = await cargarFacturas(
      admin,
      orgId,
      body.solo_sin_verificar === true,
      parseLimite(body.limite),
    );
  } catch (e) {
    await captureEdgeException(e, { fn: "verificar-sat-lote", extra: { orgId } });
    return jsonResponse({ error: "query_failed", detail: (e as Error).message }, 500, cors);
  }

  const out: Salida = {
    total: facturas.length,
    procesadas: 0,
    resumen: resumenVacio(),
    canceladas: [],
    fallos: [],
  };

  for (const f of facturas) {
    try {
      await procesarFactura(admin, f, rfcReceptor, out);
    } catch (e) {
      out.fallos.push({ id: f.id, motivo: (e as Error).message });
      out.resumen.Error += 1;
    }
    await dormir(PAUSA_MS);
  }

  console.log("[verificar-sat-lote] resumen", JSON.stringify({ orgId, ...out.resumen, canceladas: out.canceladas.length }));
  return jsonResponse(out, 200, cors);
}));
