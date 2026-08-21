/**
 * verificar-sat-semanal — Ola 2 · O2.11.2
 *
 * Barrido semanal de plataforma del estatus de CFDI ante el SAT para las
 * facturas de proveedor nacional de TODAS las organizaciones. Cuando el SAT
 * reporta un CFDI como cancelado, avisa por notificación interna a
 * contabilidad, tesorería y administración de esa organización
 * (`notificar_uuid_cancelado_sat`, con dedupe de 30 días por factura).
 *
 * Nunca cambia el estado ni los importes de las facturas: sólo verifica y avisa.
 *
 * Auth: cron-only, exige `X-Cron-Secret == CRON_SECRET` (mismo patrón que
 * `rep-retry-nocturno`). Programación: lunes 14:00 UTC (08:00 CDMX) vía pg_cron.
 *
 * Trabajo acotado por corrida (regla de jobs en segundo plano):
 *   MAX_ORGS organizaciones y MAX_FACTURAS facturas en total; se priorizan las
 *   facturas nunca verificadas y las verificadas hace más tiempo, así que las
 *   corridas siguientes avanzan sobre el resto (round-robin natural).
 *
 * v13.710.0
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler, captureEdgeException } from "../_shared/sentry.ts";
import { jsonResponse } from "../_shared/response.ts";
import { timingSafeEqual } from "../_shared/timingSafe.ts";
import {
  barrerOrganizacion,
  cargarFacturasPorAntiguedadVerificacion,
  rfcOrganizacion,
  type Cancelada,
} from "../_shared/satBarrido.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const MAX_ORGS = 5;
const MAX_FACTURAS = 60;
const POR_ORG = 20;

interface ResumenOrg {
  organization_id: string;
  total: number;
  procesadas: number;
  canceladas: number;
  avisos: number;
  error?: string;
}

async function organizacionesConRfc(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin
    .from("organizations")
    .select("id, rfc")
    .not("rfc", "is", null)
    .order("created_at", { ascending: true })
    .limit(MAX_ORGS);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string }[]).map((o) => o.id);
}

async function avisarCanceladas(
  admin: SupabaseClient,
  orgId: string,
  canceladas: Cancelada[],
): Promise<number> {
  if (canceladas.length === 0) return 0;
  const { data, error } = await admin.rpc("notificar_uuid_cancelado_sat", {
    p_org: orgId,
    p_facturas: canceladas,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

async function procesarOrg(
  admin: SupabaseClient,
  orgId: string,
  cupo: number,
): Promise<ResumenOrg> {
  const base: ResumenOrg = {
    organization_id: orgId,
    total: 0,
    procesadas: 0,
    canceladas: 0,
    avisos: 0,
  };
  const rfcReceptor = await rfcOrganizacion(admin, orgId);
  if (!rfcReceptor) return { ...base, error: "rfc_organizacion_faltante" };

  const facturas = await cargarFacturasPorAntiguedadVerificacion(
    admin,
    orgId,
    Math.min(POR_ORG, cupo),
  );
  const out = await barrerOrganizacion(admin, orgId, facturas, rfcReceptor);
  const avisos = await avisarCanceladas(admin, orgId, out.canceladas);

  return {
    organization_id: orgId,
    total: out.total,
    procesadas: out.procesadas,
    canceladas: out.canceladas.length,
    avisos,
  };
}

Deno.serve(wrapEdgeHandler("verificar-sat-semanal", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  const header = req.headers.get("X-Cron-Secret") ?? "";
  if (!CRON_SECRET || !timingSafeEqual(header, CRON_SECRET)) {
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  let orgs: string[];
  try {
    orgs = await organizacionesConRfc(admin);
  } catch (e) {
    await captureEdgeException(e, { fn: "verificar-sat-semanal" });
    return jsonResponse({ error: "query_failed", detail: (e as Error).message }, 500);
  }

  const resumen: ResumenOrg[] = [];
  let restante = MAX_FACTURAS;

  for (const orgId of orgs) {
    if (restante <= 0) break;
    try {
      const r = await procesarOrg(admin, orgId, restante);
      restante -= r.total;
      resumen.push(r);
    } catch (e) {
      await captureEdgeException(e, { fn: "verificar-sat-semanal", extra: { orgId } });
      resumen.push({
        organization_id: orgId,
        total: 0,
        procesadas: 0,
        canceladas: 0,
        avisos: 0,
        error: (e as Error).message,
      });
    }
  }

  const totales = {
    organizaciones: resumen.length,
    procesadas: resumen.reduce((a, r) => a + r.procesadas, 0),
    canceladas: resumen.reduce((a, r) => a + r.canceladas, 0),
    avisos: resumen.reduce((a, r) => a + r.avisos, 0),
  };
  console.log("[verificar-sat-semanal] resumen", JSON.stringify(totales));
  return jsonResponse({ ...totales, detalle: resumen }, 200);
}));
