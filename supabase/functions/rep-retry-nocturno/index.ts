/**
 * rep-retry-nocturno — Cron nocturno que revisa REPs pendientes (v_pagos_rep_pendientes)
 * y crea alertas en `alertas_sistema` para el equipo de facturación cuando queda
 * poco tiempo antes de la fecha límite SAT.
 *
 * NO reintenta timbrar automáticamente: el timbrado consume créditos y requiere
 * validación humana del método/forma de pago. La alerta lleva al operador a la
 * pantalla del pago.
 *
 * Programación: 06:00 CDMX diario (12:00 UTC) vía pg_cron.
 * v13.187.0
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { wrapEdgeHandler } from "../_shared/sentry.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface PagoPendiente {
  pago_id: string | null;
  factura_id: string | null;
  factura_numero: string | null;
  factura_serie: string | null;
  organization_id: string | null;
  dias_restantes: number | null;
  fecha_limite_rep: string | null;
  monto_aplicado_factura: number | null;
  moneda: string | null;
}

function severityFor(dias: number | null): "info" | "warning" | "critical" {
  if (dias == null) return "info";
  if (dias <= 1) return "critical";
  if (dias <= 5) return "warning";
  return "info";
}

Deno.serve(wrapEdgeHandler("rep-retry-nocturno", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: pendientes, error } = await admin
    .from("v_pagos_rep_pendientes")
    .select("pago_id, factura_id, factura_numero, factura_serie, organization_id, dias_restantes, fecha_limite_rep, monto_aplicado_factura, moneda")
    .lte("dias_restantes", 7);

  if (error) return json({ error: "query_failed", detail: error.message }, 500);

  const rows = (pendientes ?? []) as PagoPendiente[];
  const alertas = rows
    .filter((r) => r.pago_id && r.factura_id)
    .map((r) => {
      const folio = `${r.factura_serie ?? ""}${r.factura_numero ?? ""}`.trim() || r.factura_id;
      const sev = severityFor(r.dias_restantes);
      return {
        source: "rep_retry_nocturno",
        severity: sev,
        message:
          sev === "critical"
            ? `REP pendiente: la factura ${folio} vence su plazo SAT en ${r.dias_restantes ?? 0} día(s).`
            : `REP pendiente: factura ${folio} — ${r.dias_restantes ?? 0} días restantes para timbrar el complemento de pago.`,
        dedupe_key: `rep_pendiente:${r.pago_id}`,
        payload: {
          pago_id: r.pago_id,
          factura_id: r.factura_id,
          organization_id: r.organization_id,
          dias_restantes: r.dias_restantes,
          fecha_limite_rep: r.fecha_limite_rep,
          monto: r.monto_aplicado_factura,
          moneda: r.moneda,
        },
      };
    });

  if (alertas.length === 0) return json({ ok: true, revisados: rows.length, alertas: 0 });

  // El índice único de dedupe_key es parcial (WHERE acknowledged_at IS NULL) —
  // filtramos manualmente para no duplicar alertas ya abiertas.
  const keys = alertas.map((a) => a.dedupe_key);
  const { data: existentes } = await admin
    .from("alertas_sistema")
    .select("dedupe_key")
    .in("dedupe_key", keys)
    .is("acknowledged_at", null);
  const abiertos = new Set((existentes ?? []).map((e) => e.dedupe_key));
  const nuevas = alertas.filter((a) => !abiertos.has(a.dedupe_key));
  if (nuevas.length === 0) return json({ ok: true, revisados: rows.length, alertas: 0, reabiertas: 0 });

  const { error: upErr } = await admin.from("alertas_sistema").insert(nuevas);
  if (upErr) return json({ error: "insert_failed", detail: upErr.message }, 500);

  return json({ ok: true, revisados: rows.length, alertas: nuevas.length });
}));
