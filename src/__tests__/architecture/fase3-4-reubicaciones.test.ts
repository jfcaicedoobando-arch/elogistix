/**
 * Fase 3/4 — Reubicaciones consolidadas. Bloquea que vuelvan a existir
 * los archivos en sus paths antiguos o que algún import los referencie.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { sync as glob } from "fast-glob";
import { join } from "node:path";

const ROOT = process.cwd();

const FORBIDDEN_PATHS = [
  "src/lib/sentry.ts",
  "src/lib/sentryHelpers.ts",
  "src/lib/sentryUser.ts",
  "src/lib/queryClient.ts",
  "src/lib/queryPersistBootstrap.ts",
  "src/features/embarques/hooks/cotizacionVinculadaContext.ts",
  "src/features/admin/components/org-detalle",
];

const FORBIDDEN_IMPORTS = [
  /@\/lib\/sentry["']/,
  /@\/lib\/sentryHelpers/,
  /@\/lib\/sentryUser/,
  /@\/lib\/queryClient/,
  /@\/lib\/queryPersistBootstrap/,
  /features\/embarques\/hooks\/cotizacionVinculadaContext/,
  /components\/org-detalle\//,
];

describe("Fase 3/4 — Reubicaciones aplicadas", () => {
  it("ningún archivo legacy queda en el path antiguo", () => {
    const stale = FORBIDDEN_PATHS.filter((p) => existsSync(join(ROOT, p)));
    expect(stale, `Paths legacy presentes:\n${stale.join("\n")}`).toEqual([]);
  });

  it("ningún archivo importa de los paths antiguos", () => {
    const files = glob("src/**/*.{ts,tsx}", {
      cwd: ROOT,
      absolute: true,
      ignore: ["src/__tests__/architecture/fase3-4-reubicaciones.test.ts"],
    });
    const offenders: string[] = [];
    for (const abs of files) {
      const src = readFileSync(abs, "utf8");
      for (const re of FORBIDDEN_IMPORTS) {
        if (re.test(src)) offenders.push(`${abs.slice(ROOT.length + 1)} viola ${re}`);
      }
    }
    expect(offenders, `Imports legacy:\n${offenders.join("\n")}`).toEqual([]);
  });
});
