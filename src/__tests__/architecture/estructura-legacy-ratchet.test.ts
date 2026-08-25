/**
 * Ratchet único de estructura legacy (consolida los antiguos
 * `fase3-4-reubicaciones`, `fase4-naming-camelcase`, `facturacion-fusion` y
 * `admin-configuracion-cycle`).
 *
 * Cubre lo que ESLint NO puede ver: que ciertas carpetas/archivos legacy dejaron
 * de existir y que las reubicaciones siguen en su lugar canónico. Los imports
 * prohibidos se validan aquí en un solo lugar en vez de 4.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { sync as glob } from "fast-glob";
import { join } from "node:path";

const ROOT = process.cwd();
const SELF = "src/__tests__/architecture/estructura-legacy-ratchet.test.ts";

/** Paths que fueron reubicados/fusionados y no deben reaparecer. */
const PATHS_PROHIBIDOS = [
  "src/lib/sentry.ts",
  "src/lib/sentryHelpers.ts",
  "src/lib/sentryUser.ts",
  "src/lib/queryClient.ts",
  "src/lib/queryPersistBootstrap.ts",
  "src/features/embarques/hooks/cotizacionVinculadaContext.ts",
  "src/features/admin/components/org-detalle",
  "src/features/facturas",
  "src/features/configuracion/components/TabExportar.tsx",
];

/** Paths canónicos que deben seguir existiendo tras las reubicaciones. */
const PATHS_CANONICOS = [
  "src/features/admin/components/TabExportar.tsx",
  "src/features/admin/components/orgDetalle",
];

const IMPORTS_PROHIBIDOS = [
  /@\/lib\/sentry["']/,
  /@\/lib\/sentryHelpers/,
  /@\/lib\/sentryUser/,
  /@\/lib\/queryClient/,
  /@\/lib\/queryPersistBootstrap/,
  /features\/embarques\/hooks\/cotizacionVinculadaContext/,
  /components\/org-detalle\//,
  /from\s+["']@\/features\/facturas(\/|["'])/,
];

const ARCHIVOS_SRC = glob("src/**/*.{ts,tsx}", {
  cwd: ROOT,
  absolute: true,
  ignore: [SELF],
});

describe("Estructura legacy — ratchet consolidado", () => {
  it("ningún path legacy reaparece", () => {
    const stale = PATHS_PROHIBIDOS.filter((p) => existsSync(join(ROOT, p)));
    expect(stale, `Paths legacy presentes:\n${stale.join("\n")}`).toEqual([]);
  });

  it("los paths canónicos siguen existiendo", () => {
    const faltantes = PATHS_CANONICOS.filter((p) => !existsSync(join(ROOT, p)));
    expect(faltantes, `Paths canónicos faltantes:\n${faltantes.join("\n")}`).toEqual([]);
  });

  it("orgDetalle conserva sus 4 cards", () => {
    const archivos = glob("*.tsx", {
      cwd: join(ROOT, "src/features/admin/components/orgDetalle"),
    }).sort();
    expect(archivos).toEqual([
      "OrgConfigCard.tsx",
      "OrgDatosGeneralesCard.tsx",
      "OrgHeader.tsx",
      "OrgMembersCard.tsx",
    ]);
  });

  it("ningún archivo importa de los paths legacy", () => {
    const offenders: string[] = [];
    for (const abs of ARCHIVOS_SRC) {
      const src = readFileSync(abs, "utf8");
      for (const re of IMPORTS_PROHIBIDOS) {
        if (re.test(src)) offenders.push(`${abs.slice(ROOT.length + 1)} viola ${re}`);
      }
    }
    expect(offenders, `Imports legacy:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("features/configuracion no reintroduce el ciclo hacia features/admin", () => {
    const offenders: string[] = [];
    const archivos = glob("src/features/configuracion/**/*.{ts,tsx}", {
      cwd: ROOT,
      absolute: true,
    });
    for (const abs of archivos) {
      const src = readFileSync(abs, "utf8");
      if (/from\s+["']@\/features\/admin(\/|["'])/.test(src)) {
        offenders.push(abs.slice(ROOT.length + 1));
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("las query keys de facturación viven en el módulo unificado", () => {
    const qk = readFileSync(join(ROOT, "src/features/facturacion/queryKeys.ts"), "utf8");
    expect(qk).toMatch(/export\s+const\s+facturas\b/);
    expect(qk).toMatch(/export\s+const\s+facturacion\b/);

    const barrel = readFileSync(join(ROOT, "src/lib/query/index.ts"), "utf8");
    expect(barrel).toMatch(/from\s+["']@\/features\/facturacion\/queryKeys["']/);
    expect(barrel).not.toMatch(/@\/features\/facturas\/queryKeys/);
  });

  it("Configuracion.tsx de admin importa TabExportar desde su ruta canónica", () => {
    const src = readFileSync(
      join(ROOT, "src/features/admin/routes/admin-org/Configuracion.tsx"),
      "utf8",
    );
    expect(src).toMatch(/from\s+["']@\/features\/admin\/components\/TabExportar["']/);
  });
});
