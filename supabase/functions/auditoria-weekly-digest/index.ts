/**
 * Digest semanal de auditoría: arma el resumen ejecutivo de cada organización
 * activa y lo envía por correo a los admins via Resend (gateway Lovable).
 *
 * Si RESEND_API_KEY no está configurado todavía, hace dry-run y registra
 * en logs sin fallar.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { wrapEdgeHandler, captureEdgeException } from "../_shared/sentry.ts"
import { timingSafeEqual } from "../_shared/timingSafe.ts";
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { registrarEstadoEmail } from "../_shared/emailSendLog.ts";

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

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildHtml(orgNombre: string, reporte: ReporteRow): string {
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

interface OrgRow { id: string; nombre: string; }
interface ProcessResult { org: string; destinatarios: number; enviado: boolean; dryRun?: boolean; omitido?: boolean; error?: string; }

/**
 * Ronda YAGNI · defecto 10 — clave semanal estable (año-semana ISO en UTC).
 * Permite deduplicar el digest: si el cron reintenta tras un 5xx, las orgs
 * que ya recibieron el correo de esa semana se omiten.
 */
export function claveSemana(fecha: Date): string {
  const d = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  const dia = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dia);
  const inicioAnio = Date.UTC(d.getUTCFullYear(), 0, 1);
  const semana = Math.ceil(((d.getTime() - inicioAnio) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, "0")}`;
}

export function messageIdDigest(orgId: string, semana: string): string {
  return `auditoria-digest-${orgId}-${semana}`;
}

async function yaEnviadoEstaSemana(admin: SupabaseClient, messageId: string): Promise<boolean> {
  const { data } = await admin
    .from("email_send_log")
    .select("status")
    .eq("message_id", messageId)
    .eq("status", "sent")
    .maybeSingle();
  return !!data;
}

async function resolveAdminEmails(admin: SupabaseClient, orgId: string): Promise<string[]> {
  const { data: members } = await admin
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", orgId)
    .eq("role", "admin");
  const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  const emails: string[] = [];
  for (const uid of userIds) {
    const { data: u } = await admin.auth.admin.getUserById(uid);
    if (u?.user?.email) emails.push(u.user.email);
  }
  return emails;
}

interface SendDigestArgs {
  org: OrgRow;
  emails: string[];
  html: string;
  lovableKey: string;
  resendKey: string;
  admin: SupabaseClient;
  messageId: string;
}

async function sendDigest({ org, emails, html, lovableKey, resendKey, admin, messageId }: SendDigestArgs): Promise<ProcessResult> {
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
  const error = res.ok ? undefined : await res.text();
  // Defecto 10: deja constancia del intento para que el reintento del cron no
  // duplique correos ya enviados.
  await registrarEstadoEmail(admin, {
    messageId,
    templateName: "auditoria-weekly-digest",
    recipientEmail: emails[0] ?? "",
    status: res.ok ? "sent" : "failed",
    errorMessage: error ?? null,
  });
  return { org: org.nombre, destinatarios: emails.length, enviado: res.ok, error };
}

async function processOrg(admin: SupabaseClient, org: OrgRow, lovableKey: string | undefined, resendKey: string | undefined): Promise<ProcessResult> {
  const { data: reporte, error: rpcErr } = await admin.rpc("auditoria_embarques_org", { p_organization_id: org.id });
  if (rpcErr) {
    console.error(`[auditoria-weekly-digest] RPC error org=${org.id}:`, rpcErr);
    // 13.114.19: errores por-org no escapaban del `processOrg` (devolvía 200 al cron).
    // Capturar explícitamente para que Sentry vea cada fallo individual.
    await captureEdgeException(rpcErr, {
      fn: "auditoria-weekly-digest",
      organization_id: org.id,
      extra: { organization_nombre: org.nombre, phase: "rpc_auditoria" },
    });
    return { org: org.nombre, destinatarios: 0, enviado: false, error: `RPC: ${rpcErr.message}` };
  }
  const emails = await resolveAdminEmails(admin, org.id);
  if (emails.length === 0) return { org: org.nombre, destinatarios: 0, enviado: false };
  const messageId = messageIdDigest(org.id, claveSemana(new Date()));
  if (await yaEnviadoEstaSemana(admin, messageId)) {
    return { org: org.nombre, destinatarios: emails.length, enviado: true, omitido: true };
  }
  const html = buildHtml(org.nombre, (reporte ?? {}) as ReporteRow);
  if (!lovableKey || !resendKey) {
    console.log(`[auditoria-weekly-digest] DRY-RUN para ${org.nombre} (${emails.length} destinatarios)`);
    return { org: org.nombre, destinatarios: emails.length, enviado: false, dryRun: true };
  }
  return sendDigest({ org, emails, html, lovableKey, resendKey, admin, messageId });
}

function unauthorized(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 401,
  });
}

Deno.serve(wrapEdgeHandler("auditoria-weekly-digest", async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const corsHeaders = buildCors(req);
  const log = createLogger(req, "auditoria-weekly-digest");

  const cronSecret = Deno.env.get("CRON_SECRET");
  const headerSecret = req.headers.get("X-Cron-Secret");
  // R3 · P3: comparación constante en tiempo (patrón _shared/timingSafe.ts).
  if (!cronSecret || !timingSafeEqual(headerSecret ?? "", cronSecret)) {
    log.finish(401, "unauthorized_cron");
    return unauthorized(corsHeaders);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: orgs } = await admin.from("organizations").select("id, nombre").eq("activo", true);
    const resultados: ProcessResult[] = [];
    for (const org of (orgs ?? []) as OrgRow[]) {
      resultados.push(await processOrg(admin, org, lovableKey, resendKey));
    }

    const enviados = resultados.filter((r) => r.enviado).length;
    const dryRun = resultados.filter((r) => r.dryRun).length;
    // Defecto 10: un fallo por-org ya no se reporta como 200; el cron debe ver
    // 500 para alertar y reintentar (el envío es idempotente por semana).
    const fallos = resultados.filter((r) => r.error).length;
    const status = fallos > 0 ? 500 : 200;
    log.finish(status, "digest_run", { payload: { total: resultados.length, enviados, dryRun, fallos } });
    return new Response(JSON.stringify({ ok: fallos === 0, total: resultados.length, fallos, resultados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  } catch (err) {
    const msg = (err as Error).message;
    console.error("[auditoria-weekly-digest] error:", err);
    log.finish(500, "unhandled_error", { payload: { error: msg } });
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
}));
