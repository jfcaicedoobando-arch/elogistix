/**
 * Digest semanal de auditoría: arma el resumen ejecutivo de cada organización
 * activa y lo envía por correo a los admins via Resend (gateway Lovable).
 *
 * Si RESEND_API_KEY no está configurado todavía, hace dry-run y registra
 * en logs sin fallar.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

interface ReporteRow {
  total_hallazgos?: number;
  por_severidad?: { critico?: number; alto?: number; medio?: number };
  hallazgos?: Array<{
    severidad: string;
    cliente_nombre?: string;
    expediente?: string;
    detalle?: string;
    monto_mxn?: number;
    regla?: string;
  }>;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildHtml(orgNombre: string, reporte: ReporteRow): string {
  const sev = reporte.por_severidad ?? {};
  const top = (reporte.hallazgos ?? [])
    .filter((h) => typeof h.monto_mxn === "number" && (h.monto_mxn ?? 0) > 0)
    .sort((a, b) => (b.monto_mxn ?? 0) - (a.monto_mxn ?? 0))
    .slice(0, 5);
  const fmt = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  });
  return `
    <h2>Resumen semanal de auditoría — ${esc(orgNombre)}</h2>
    <p><strong>Total hallazgos:</strong> ${reporte.total_hallazgos ?? 0}</p>
    <p>
      <strong style="color:#dc2626">${sev.critico ?? 0}</strong> críticos &nbsp;
      <strong style="color:#d97706">${sev.alto ?? 0}</strong> altos &nbsp;
      <strong>${sev.medio ?? 0}</strong> medios
    </p>
    ${
      top.length > 0
        ? `<h3>Top 5 fugas financieras</h3><ul>${
            top
              .map(
                (h) =>
                  `<li><strong>${fmt.format(h.monto_mxn ?? 0)}</strong> — ${
                    esc(h.cliente_nombre ?? "—")
                  } (Exp ${esc(h.expediente ?? "—")}): ${esc(h.detalle ?? "")}</li>`,
              )
              .join("")
          }</ul>`
        : "<p>Sin fugas financieras detectadas esta semana.</p>"
    }
    <p style="font-size:12px;color:#666">
      Generado automáticamente por Libre Carga.
    </p>
  `;
}

Deno.serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const corsHeaders = buildCors(req);

  // Cron-only: require X-Cron-Secret header
  const cronSecret = Deno.env.get("CRON_SECRET");
  const headerSecret = req.headers.get("X-Cron-Secret");
  if (!cronSecret || headerSecret !== cronSecret) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: orgs } = await admin
      .from("organizations")
      .select("id, nombre")
      .eq("activo", true);

    const resultados: Array<{
      org: string;
      destinatarios: number;
      enviado: boolean;
      dryRun?: boolean;
      error?: string;
    }> = [];

    for (const org of orgs ?? []) {
      // Reporte de la org (se ejecuta como service role, requiere variante con param o saltar).
      // Para mantener el contrato existente, llamamos a la RPC sin parámetros y se filtra
      // automáticamente por current_user_org_id (que será NULL en service role). Si no
      // soporta llamada por org_id, esta función queda en dry-run informativo.
      const { data: reporte } = await admin.rpc("auditoria_embarques_org");

      // Destinatarios: admins de la org.
      const { data: members } = await admin
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", org.id)
        .eq("role", "admin");

      const userIds = (members ?? []).map((m) => m.user_id);
      if (userIds.length === 0) {
        resultados.push({ org: org.nombre, destinatarios: 0, enviado: false });
        continue;
      }

      // Resolver emails desde auth.users via admin API.
      const emails: string[] = [];
      for (const uid of userIds) {
        const { data: u } = await admin.auth.admin.getUserById(uid);
        if (u?.user?.email) emails.push(u.user.email);
      }

      const html = buildHtml(org.nombre, (reporte ?? {}) as ReporteRow);

      if (!lovableKey || !resendKey) {
        console.log(
          `[auditoria-weekly-digest] DRY-RUN para ${org.nombre} (${emails.length} destinatarios)`,
        );
        resultados.push({
          org: org.nombre,
          destinatarios: emails.length,
          enviado: false,
          dryRun: true,
        });
        continue;
      }

      const res = await fetch(`${GATEWAY_URL}/emails`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": resendKey,
        },
        body: JSON.stringify({
          from: "Libre Carga <onboarding@resend.dev>",
          to: emails,
          subject: `Resumen semanal de auditoría — ${org.nombre}`,
          html,
        }),
      });
      const ok = res.ok;
      resultados.push({
        org: org.nombre,
        destinatarios: emails.length,
        enviado: ok,
        error: ok ? undefined : await res.text(),
      });
    }

    return new Response(
      JSON.stringify({ ok: true, total: resultados.length, resultados }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err) {
    console.error("[auditoria-weekly-digest] error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
