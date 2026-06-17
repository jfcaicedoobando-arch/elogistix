/**
 * Fase 4 — Estandarización de carpetas: features/admin/components/orgDetalle/
 * (camelCase). Previene la reaparición de la variante kebab-case `org-detalle`
 * y exige que las 4 cards del módulo vivan en la nueva ubicación.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { sync as glob } from "fast-glob";
import { join } from "node:path";

const ROOT = process.cwd();
const ORG_DETALLE_DIR = "src/features/admin/components/orgDetalle";

describe("Fase 4 — Naming camelCase para orgDetalle", () => {
  it("la carpeta legacy 'org-detalle' no existe", () => {
    expect(existsSync(join(ROOT, "src/features/admin/components/org-detalle"))).toBe(false);
  });

  it("la nueva carpeta orgDetalle contiene las 4 cards", () => {
    const archivos = glob("*.tsx", { cwd: join(ROOT, ORG_DETALLE_DIR) }).sort();
    expect(archivos).toEqual([
      "OrgConfigCard.tsx",
      "OrgHeader.tsx",
      "OrgInfoCard.tsx",
      "OrgMembersCard.tsx",
    ]);
  });

  it("ningún archivo de src/ referencia el path kebab-case legacy", () => {
    const files = glob("src/**/*.{ts,tsx}", {
      cwd: ROOT,
      absolute: true,
      ignore: [
        "src/__tests__/architecture/fase4-naming-camelcase.test.ts",
        "src/__tests__/architecture/fase3-4-reubicaciones.test.ts",
      ],
    });
    const offenders: string[] = [];
    for (const abs of files) {
      const { readFileSync } = await import("node:fs");
      const src = readFileSync(abs, "utf8");
      if (/components\/org-detalle\//.test(src)) {
        offenders.push(abs.slice(ROOT.length + 1));
      }
    }
    expect(offenders).toEqual([]);
  });
});
