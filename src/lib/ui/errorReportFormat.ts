/**
 * Helpers de formateo Markdown para `errorReport.ts`.
 * Extraído para mantener complejidad <15 en `formatReportMarkdown`.
 */
import type { ErrorReport } from "@/lib/diagnostics/errorReportTypes";

export function fmtHeader(r: ErrorReport): string[] {
  const lines = [
    `**Error en Libre Carga**`,
    `- Título: ${r.title}`,
  ];
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
  return lines;
}

export function fmtErrorBlock(ed: ErrorReport["errorDetails"]): string[] {
  if (!ed.message && !ed.code && !ed.status) return [];
  const lines: string[] = ["", "**Mensaje**", ed.message ?? "(sin mensaje)"];
  const tech: string[] = [];
  if (ed.name) tech.push(`name: ${ed.name}`);
  if (ed.code !== undefined) tech.push(`code: ${ed.code}`);
  if (ed.status !== undefined) tech.push(`status: ${ed.status}`);
  if (ed.details) tech.push(`details: ${ed.details}`);
  if (ed.hint) tech.push(`hint: ${ed.hint}`);
  if (tech.length) lines.push("", "**Detalles técnicos**", ...tech);
  return lines;
}

export function fmtContextBlock(context: ErrorReport["context"]): string[] {
  if (!context || Object.keys(context).length === 0) return [];
  return ["", "**Contexto**", "```json", JSON.stringify(context, null, 2), "```"];
}

export function fmtStackBlock(stack: string | undefined): string[] {
  if (!stack) return [];
  return ["", "**Stack**", "```", stack, "```"];
}
