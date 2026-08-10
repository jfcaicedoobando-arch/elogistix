/**
 * tc-dof-diario — cron diario que guarda el TC de Publicación DOF (USD/EUR)
 * en la tabla interna `public.tipos_cambio_dof`.
 *
 * Auth: header `X-Cron-Secret` == `CRON_SECRET` (cron-only).
 *
 * Body opcional:
 *   { "dias": 30 }  → backfill de los últimos N días (idempotente).
 *
 * Nunca guarda valores estimados: si Banxico no responde el TC USD, ese día
 * simplemente no se registra y el error queda en logs/Sentry.
 */
// @ts-expect-error Deno remote import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCors, handlePreflightStrict } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logger.ts";
import { initSentryEdge, captureEdgeException } from "../_shared/sentry.ts";
import {
  fetchEurBanxico,
  fetchUsdDof,
  isoDiaMexico,
} from "../_shared/banxicoDof.ts";

initSentryEdge("tc-dof-diario");

const FETCH_TIMEOUT_MS = 10_000;
const MAX_DIAS_BACKFILL = 90;

/** Valida el secreto de cron. */
export function checkCronSecret(
  secret: string | undefined,
  headerValue: string | null,
): boolean {
  return !!(secret && headerValue === secret);
}

/** Normaliza el parámetro `dias` (1 = sólo hoy). */
export function normalizarDias(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), MAX_DIAS_BACKFILL);
}

/** Lista de fechas objetivo (hoy hacia atrás) en formato ISO. */
export function fechasObjetivo(hoy: Date, dias: number): Date[] {
  const out: Date[] = [];
  for (let i = 0; i < dias; i++) {
    const d = new Date(hoy);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d);
  }
  return out;
}

interface RegistroTc {
  fecha: string;
  usd_mxn: number;
  eur_mxn: number | null;
  fuente: string;
  origen: string;
  fecha_publicacion_usd: string | null;
}

/** Obtiene el registro de un día; `null` si Banxico no dio TC USD. */
export async function construirRegistro(
  token: string,
  fecha: Date,
  esHoy: boolean,
  signal?: AbortSignal,
): Promise<RegistroTc | null> {
  const [usd, eur] = await Promise.all([
    fetchUsdDof(token, signal, fecha),
    fetchEurBanxico(token, signal, fecha, esHoy),
  ]);
  if (usd.tc == null) return null;
  return {
    // N14 (Ola 4): la fila se registra con el día civil MX; antes el UTC
    // escribía el TC de hoy con la fecha de "mañana" entre 18:00 y 23:59 CST.
    fecha: isoDiaMexico(fecha),
    usd_mxn: usd.tc,
    eur_mxn: eur,
    fuente: "banxico_sie",
    origen: "cron",
    fecha_publicacion_usd: usd.fechaAplicada ?? null,
  };
}

Deno.serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const corsHeaders = buildCors(req);
  const log = createLogger(req, "tc-dof-diario");
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // @ts-expect-error Deno global
  const cronSecret = Deno.env.get("CRON_SECRET");
  if (!checkCronSecret(cronSecret, req.headers.get("X-Cron-Secret"))) {
    log.finish(401, "unauthorized_cron");
    return json({ ok: false, error: "Unauthorized" }, 401);
  }

  // @ts-expect-error Deno global
  const token = Deno.env.get("BANXICO_SIE_TOKEN");
  if (!token) {
    log.finish(500, "sin_token_banxico");
    return json({ ok: false, error: "BANXICO_SIE_TOKEN no configurado" }, 500);
  }

  let dias = 1;
  try {
    const body = await req.clone().json();
    dias = normalizarDias(body?.dias ?? 1);
  } catch { /* sin body → sólo hoy */ }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS * dias);

  try {
    // @ts-expect-error Deno global
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    // @ts-expect-error Deno global
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const registros: RegistroTc[] = [];
    const omitidos: string[] = [];
    const fechas = fechasObjetivo(new Date(), dias);

    for (let i = 0; i < fechas.length; i++) {
      const reg = await construirRegistro(token, fechas[i], i === 0, ctrl.signal);
      if (reg) registros.push(reg);
      else omitidos.push(isoDiaMexico(fechas[i]));
    }

    if (registros.length > 0) {
      // Idempotente: la PK es `fecha`, así que correr dos veces el mismo día
      // actualiza en vez de duplicar.
      const { error } = await admin
        .from("tipos_cambio_dof")
        .upsert(registros, { onConflict: "fecha" });
      if (error) throw error;
    }

    log.finish(200, "tc_dof_ok", {
      payload: { guardados: registros.length, omitidos: omitidos.length },
    });
    return json({ ok: true, guardados: registros.length, omitidos }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[tc-dof-diario]", message);
    await captureEdgeException(err, { fn: "tc-dof-diario", status_code: 500 });
    log.finish(500, "tc_dof_error", { payload: { error: message } });
    return json({ ok: false, error: message }, 500);
  } finally {
    clearTimeout(timer);
  }
});
