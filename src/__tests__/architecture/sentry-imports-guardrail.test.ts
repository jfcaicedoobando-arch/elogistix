/**
 * Plan E (audit Sentry): guardrail arquitectónico — ningún archivo de
 * `components/`, `pages/`, `contexts/` o `lib/` debe importar `@sentry/*`
 * de forma estática (excepto la allowlist abajo). Los demás puntos de
 * captura deben usar `void import("@sentry/react").then(...)` para no
 * inflar el bundle inicial. ESLint ya lo bloquea; este test garantiza que
 * la regla se cumple incluso si alguien la suprime con un disable comment.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");
const SCOPES = ["src/components", "src/pages", "src/lib"];

/** Archivos donde el import estático de @sentry/* es intencional y aceptado.
 *  Debe mantenerse sincronizado con la allowlist del bloque
 *  `no-restricted-imports` en `eslint.config.js`. */
const ALLOWLIST = new Set<string>([
  // Núcleo de observabilidad — único punto donde se inicializa el SDK.
  "src/lib/observability/sentry/core.ts",
  "src/lib/observability/sentry/helpers.ts",
  "src/lib/observability/sentry/user.ts",
  "src/lib/observability/sentry/dropPredicate.ts",
  // Widget de feedback: usa Sentry.getFeedback() — la API requiere import síncrono.
  "src/components/feedback/FeedbackButton.tsx",
  // Página interna de diagnóstico Sentry (sólo cargada bajo /admin/sentry).
  "src/features/admin/routes/SentryDiagnostico.tsx",
  // Hook de diagnóstico Sentry (sólo consumido por la página /admin/sentry).
  "src/lib/observability/hooks/useSentryInfo.ts",
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

const STATIC_IMPORT_RE = /^\s*import\s+[^;]*?from\s+["']@sentry\//m;

describe("Sentry imports guardrail", () => {
  it("ningún archivo fuera de la allowlist importa @sentry/* estático", () => {
    const offenders: string[] = [];
    for (const scope of SCOPES) {
      const files = walk(path.join(ROOT, scope));
      for (const f of files) {
        const rel = path.relative(ROOT, f).split(path.sep).join("/");
        if (ALLOWLIST.has(rel)) continue;
        const src = fs.readFileSync(f, "utf-8");
        if (STATIC_IMPORT_RE.test(src)) offenders.push(rel);
      }
    }
    expect(offenders, `Static @sentry imports detected:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("la allowlist apunta a archivos existentes (evita drift)", () => {
    for (const rel of ALLOWLIST) {
      expect(fs.existsSync(path.join(ROOT, rel)), `Allowlist obsoleta: ${rel}`).toBe(true);
    }
  });
});
