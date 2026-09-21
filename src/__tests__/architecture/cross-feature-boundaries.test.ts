/**
 * P1-A — Frontera entre features.
 *
 * Verifica que:
 *   1. el inventario de features se descubre del filesystem (no hay lista
 *      manual que pueda quedar desfasada);
 *   2. `anticipos-proveedor`, `cobranza`, `cxc` y `expediente` —los cuatro que
 *      faltaban en la lista manual— quedan protegidos;
 *   3. un import profundo cross-feature FALLA con la config real de ESLint;
 *   4. un import al barrel raíz de otro feature PASA;
 *   5. un import interno del MISMO feature PASA.
 */
import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ESLint } from "eslint";
import { listFeatures, crossFeaturePatterns } from "../../../scripts/lib/features.mjs";

const ROOT = process.cwd();

/** Un archivo virtual dentro del feature `cxc` (uno de los 4 que faltaban). */
const ARCHIVO_VIRTUAL = "src/features/cxc/__frontera_probe.ts";

async function erroresDeFrontera(code: string, filePath = ARCHIVO_VIRTUAL) {
  const eslint = new ESLint({ cwd: ROOT });
  const [res] = await eslint.lintText(code, { filePath, warnIgnored: false });
  return (res?.messages ?? []).filter(
    (m) => m.ruleId === "no-restricted-imports" && /Cross-feature/.test(m.message),
  );
}

describe("P1-A · inventario de features", () => {
  it("coincide exactamente con las carpetas reales de src/features", () => {
    const reales = readdirSync(join(ROOT, "src", "features"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();
    expect(listFeatures(ROOT)).toEqual(reales);
  });

  it("incluye los cuatro features que faltaban en la lista manual", () => {
    const features = listFeatures(ROOT);
    for (const f of ["anticipos-proveedor", "cobranza", "cxc", "expediente"]) {
      expect(features, `${f} debe estar protegido`).toContain(f);
      // Y además debe generar patrones para el resto de features.
      const grupos = crossFeaturePatterns(f, features).flatMap((p) => p.group);
      expect(grupos.some((g) => g.startsWith("@/features/") && g.endsWith("/*/**"))).toBe(true);
    }
  });
});

describe("P1-A · ESLint bloquea internals de otros features", () => {
  it("falla un import profundo cross-feature", async () => {
    const msgs = await erroresDeFrontera(
      'import { X } from "@/features/dashboard/direccion/components/Foo";\nexport const a = X;\n',
    );
    expect(msgs.length, JSON.stringify(msgs)).toBe(1);
  });

  it("falla un import a components/ de otro feature", async () => {
    const msgs = await erroresDeFrontera(
      'import { X } from "@/features/expediente/components/Foo";\nexport const a = X;\n',
    );
    expect(msgs.length).toBe(1);
  });

  it("permite el barrel raíz de otro feature", async () => {
    const msgs = await erroresDeFrontera(
      'import { X } from "@/features/tesoreria";\nexport const a = X;\n',
    );
    expect(msgs, JSON.stringify(msgs)).toEqual([]);
  });

  it("permite imports internos del mismo feature (incluso profundos)", async () => {
    const msgs = await erroresDeFrontera(
      'import { X } from "@/features/cxc/components/interno/Foo";\nexport const a = X;\n',
    );
    expect(msgs, JSON.stringify(msgs)).toEqual([]);
  });

  it("ningún feature importa el banner de tipo de cambio desde dashboard", async () => {
    const msgs = await erroresDeFrontera(
      'import { B } from "@/features/dashboard/direccion/components/TipoCambioFallbackBanner";\nexport const a = B;\n',
      "src/features/compras/routes/__frontera_probe.ts",
    );
    expect(msgs.length).toBe(1);
  });
});
