/**
 * Construye reportes de error completos y copiables para soporte/Lovable.
 * Captura: versión, ruta, usuario+organización, user agent, viewport, fase,
 * mensaje, código Postgrest/HTTP, stack y `context` arbitrario por call site.
 */
import { APP_VERSION } from "@/constants/appVersion";
import { getAuthSnapshot } from "@/lib/ui/authSnapshot";

export interface ErrorReportInput {
  title?: string;
  description?: string;
  phase?: string;
  step?: number;
  error?: unknown;
  context?: Record<string, unknown>;
}

export interface ErrorReport {
  title: string;
  description?: string;
  phase?: string;
  step?: number;
  version: string;
  timestampIso: string;
  timezone: string;
  route: string;
  user: {
    id: string | null;
    email: string | null;
    organizationId: string | null;
    organizationName: string | null;
    effectiveRole: string | null;
  };
  client: {
    userAgent: string;
    viewport: string;
    devicePixelRatio: number;
  };
  errorDetails: {
    message?: string;
    name?: string;
    code?: string | number;
    status?: number;
    details?: string;
    hint?: string;
    stack?: string;
  };
  context?: Record<string, unknown>;
}

interface MaybePostgrestError {
  message?: unknown;
  name?: unknown;
  code?: unknown;
  status?: unknown;
  details?: unknown;
  hint?: unknown;
  stack?: unknown;
}

function extractErrorDetails(err: unknown): ErrorReport["errorDetails"] {
  if (err == null) return {};
  if (typeof err === "string") return { message: err };
  if (err instanceof Error) {
    const anyErr = err as Error & MaybePostgrestError;
    return {
      message: err.message,
      name: err.name,
      stack: err.stack,
      code: typeof anyErr.code === "string" || typeof anyErr.code === "number" ? anyErr.code : undefined,
      status: typeof anyErr.status === "number" ? anyErr.status : undefined,
      details: typeof anyErr.details === "string" ? anyErr.details : undefined,
      hint: typeof anyErr.hint === "string" ? anyErr.hint : undefined,
    };
  }
  if (typeof err === "object") {
    const e = err as MaybePostgrestError;
    return {
      message: typeof e.message === "string" ? e.message : JSON.stringify(err),
      name: typeof e.name === "string" ? e.name : undefined,
      code: typeof e.code === "string" || typeof e.code === "number" ? e.code : undefined,
      status: typeof e.status === "number" ? e.status : undefined,
      details: typeof e.details === "string" ? e.details : undefined,
      hint: typeof e.hint === "string" ? e.hint : undefined,
      stack: typeof e.stack === "string" ? e.stack : undefined,
    };
  }
  return { message: String(err) };
}

export function buildErrorReport(input: ErrorReportInput): ErrorReport {
  const auth = getAuthSnapshot();
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const route = typeof window !== "undefined"
    ? `${window.location.pathname}${window.location.search}${window.location.hash}`
    : "";
  const viewport = typeof window !== "undefined"
    ? `${window.innerWidth}x${window.innerHeight}`
    : "";

  return {
    title: input.title ?? "Error",
    description: input.description,
    phase: input.phase,
    step: input.step,
    version: APP_VERSION,
    timestampIso: now.toISOString(),
    timezone: tz,
    route,
    user: {
      id: auth.userId,
      email: auth.email,
      organizationId: auth.organizationId,
      organizationName: auth.organizationName,
      effectiveRole: auth.effectiveRole,
    },
    client: {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      viewport,
      devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : 1,
    },
    errorDetails: extractErrorDetails(input.error),
    context: input.context,
  };
}

export function formatReportMarkdown(r: ErrorReport): string {
  const lines: string[] = [];
  lines.push(`**Error en Libre Carga**`);
  lines.push(`- Título: ${r.title}`);
  if (r.description) lines.push(`- Descripción: ${r.description}`);
  if (r.phase) lines.push(`- Fase: ${r.phase}`);
  if (typeof r.step === "number") lines.push(`- Paso: ${r.step}`);
  lines.push(`- Versión: ${r.version}`);
  lines.push(`- Fecha: ${r.timestampIso} (${r.timezone})`);
  lines.push(`- Ruta: ${r.route}`);
  lines.push(
    `- Usuario: ${r.user.email ?? "—"} (id ${r.user.id ?? "—"}) — org "${r.user.organizationName ?? "—"}" (${r.user.organizationId ?? "—"}) — rol ${r.user.effectiveRole ?? "—"}`,
  );
  lines.push(`- Cliente: ${r.client.viewport} @${r.client.devicePixelRatio}x — ${r.client.userAgent}`);

  const ed = r.errorDetails;
  if (ed.message || ed.code || ed.status) {
    lines.push("", "**Mensaje**", ed.message ?? "(sin mensaje)");
    const tech: string[] = [];
    if (ed.name) tech.push(`name: ${ed.name}`);
    if (ed.code !== undefined) tech.push(`code: ${ed.code}`);
    if (ed.status !== undefined) tech.push(`status: ${ed.status}`);
    if (ed.details) tech.push(`details: ${ed.details}`);
    if (ed.hint) tech.push(`hint: ${ed.hint}`);
    if (tech.length) lines.push("", "**Detalles técnicos**", ...tech);
  }

  if (r.context && Object.keys(r.context).length > 0) {
    lines.push("", "**Contexto**", "```json", JSON.stringify(r.context, null, 2), "```");
  }

  if (ed.stack) {
    lines.push("", "**Stack**", "```", ed.stack, "```");
  }

  return lines.join("\n");
}

export function formatReportJson(r: ErrorReport): string {
  return JSON.stringify(r, null, 2);
}
