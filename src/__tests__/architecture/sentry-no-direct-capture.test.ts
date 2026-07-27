/**
 * Guardrail (Auditoría Sentry · Tanda 1 · S1 — 13.320.23):
 * `Sentry.captureException` / `Sentry.captureMessage` sólo deben aparecer
 * dentro de `src/lib/observability/**` (núcleo del wrapper) y en
 * `ErrorBoundary.tsx` (necesita el `eventId` para el feedback dialog).
 *
 * El resto de la app debe usar `reportCaughtError` (tags automáticos de
 * tenant/route/version) o `logger.error` (rutea a Sentry + `app_logs`).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const SRC = path.join(ROOT, "src");

const ALLOWLIST = new Set<string>([
  // Núcleo del wrapper.
  "src/lib/observability/logger.ts",
  "src/lib/observability/reportCaughtError.ts",
  "src/lib/observability/sentry/core.ts",
  "src/lib/observability/sentry/helpers.ts",
  "src/lib/observability/sentry/user.ts",
  "src/lib/observability/sentry/dropPredicate.ts",
  // ErrorBoundary necesita `eventId` retornado por captureException.
  "src/components/shared/ErrorBoundary.tsx",
  // Página interna de diagnóstico.
  "src/features/admin/routes/SentryDiagnostico.tsx",
  // Reporte de feedback (usa `getFeedback` y captura directa por diseño).
  "src/components/shared/errorBoundary/reportFeedback.ts",
]);

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const CAPTURE_RE = /\bSentry\.capture(Exception|Message)\s*\(/;

describe("Sentry direct capture guardrail", () => {
  it("captureException/Message sólo se usan en la allowlist", () => {
    const offenders: string[] = [];
    for (const f of walk(SRC)) {
      const rel = path.relative(ROOT, f).split(path.sep).join("/");
      if (ALLOWLIST.has(rel)) continue;
      const src = fs.readFileSync(f, "utf-8");
      if (CAPTURE_RE.test(src)) offenders.push(rel);
    }
    expect(
      offenders,
      `Direct Sentry.capture* fuera de allowlist. Usa reportCaughtError o logger.error:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("la allowlist de direct-capture apunta a archivos existentes (evita drift)", () => {
    for (const rel of ALLOWLIST) {
      expect(fs.existsSync(path.join(ROOT, rel)), `Allowlist obsoleta: ${rel}`).toBe(true);
    }
  });
});
