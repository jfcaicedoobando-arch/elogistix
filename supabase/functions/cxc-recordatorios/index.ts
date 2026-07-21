// CxC recordatorios (Sprint 1 — stub).
//
// Devuelve facturas por organización con saldo > 0 segmentadas por ventana
// de cobranza (-3d antes del vencimiento, +7d y +15d después). El envío real
// (correo / WhatsApp) se implementará en un sprint posterior cuando se
// integre Resend / WhatsApp Business.
//
// 12.51.14 — endurecido: requiere JWT y rol admin/operador. Para no-globalAdmin,
// la consulta se fuerza a la organización del caller para evitar fugas
// cross-tenant.
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { authenticate, checkAdminAccess } from "../_shared/auth.ts";
import { initSentryEdge, captureEdgeException } from "../_shared/sentry.ts";

initSentryEdge("cxc-recordatorios");

import {
  ventana,
  buildBucketEntry,
  calcularSaldoFactura,
  diasParaVencer,
  type FacturaRow,
} from "./helpers.ts";

interface Body { organization_id?: string }







async function authorize(req: Request, cors: Record<string, string>) {
  try {
    const auth = await authenticate(req);
    const { isGlobalAdmin, orgId: callerOrgId } = await checkAdminAccess(auth.adminClient, auth.userId);
    if (!isGlobalAdmin && !callerOrgId) {
      return {
        error: new Response(
          JSON.stringify({ ok: false, error: "Permisos insuficientes" }),
          { status: 403, headers: { ...cors, "Content-Type": "application/json" } },
        ),
      };
    }
    return { auth, isGlobalAdmin, callerOrgId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.startsWith("401:") ? 401 : 500;
    return {
      error: new Response(
        JSON.stringify({ ok: false, error: "No autorizado" }),
        { status, headers: { ...cors, "Content-Type": "application/json" } },
      ),
    };
  }
}

Deno.serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);

  try {
    const authResult = await authorize(req, cors);
    if ("error" in authResult) return authResult.error;
    const { auth, isGlobalAdmin, callerOrgId } = authResult;

    const body = (await req.json().catch(() => ({}))) as Body;
    const effectiveOrgId = isGlobalAdmin ? body.organization_id : callerOrgId;

    let query = auth.adminClient
      .from("facturas")
      .select(`
        id, numero, cliente_id, cliente_nombre, total, moneda, fecha_vencimiento,
        pagos_factura(monto_aplicado_factura, deleted_at),
        factura_notas_credito(monto, estado, deleted_at)
      `)
      .in("estado", ["Emitida", "Parcialmente pagada", "Vencida"])
      .is("deleted_at", null)
      .limit(5000);

    if (effectiveOrgId) query = query.eq("organization_id", effectiveOrgId);

    const { data, error } = await query;
    if (error) throw error;

    // FIX-12 · Anclar "hoy" a la fecha local de CDMX (no UTC): entre 18:00–23:59
    // CDMX el `setUTCHours(0)` avanzaba al día siguiente y una factura que vencía
    // ese mismo día aparecía como "vencida" antes de tiempo.
    const hoyMxIso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
    const [hy, hm, hd] = hoyMxIso.split("-").map(Number);
    const hoy = new Date(Date.UTC(hy, hm - 1, hd));

    const buckets: Record<string, Array<Record<string, unknown>>> = { "T-3": [], "T+7": [], "T+15": [] };

    for (const f of (data ?? []) as FacturaRow[]) {
      const saldo = calcularSaldoFactura(f);
      if (saldo <= 0.01) continue;
      const dias = diasParaVencer(f.fecha_vencimiento, hoy);
      const v = ventana(dias);
      if (!v) continue;
      buckets[v].push(buildBucketEntry(f, saldo, dias));
    }

    return new Response(JSON.stringify({ ok: true, generado_en: new Date().toISOString(), buckets }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await captureEdgeException(e, { fn: "cxc-recordatorios", status_code: 500 });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { ...cors, "Content-Type": "application/json" }, status: 500,
    });
  }
});
