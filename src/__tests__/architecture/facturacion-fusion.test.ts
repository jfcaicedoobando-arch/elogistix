/**
 * Blinda Fase 1 item #1: fusión `features/facturacion` + `features/facturas`.
 * Falla si la partición vuelve a aparecer o si alguien importa la ruta vieja.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = process.cwd();

describe("Fase 1 #1 — fusión facturacion + facturas", () => {
  it("el directorio src/features/facturas/ no existe", () => {
    expect(existsSync(join(ROOT, "src/features/facturas"))).toBe(false);
  });

  it("ningún archivo en src/ importa de @/features/facturas/...", () => {
    const offenders: string[] = [];
    for (const file of walk(join(ROOT, "src"))) {
      const rel = relPath(ROOT, file);
      if (rel.endsWith("facturacion-fusion.test.ts")) continue;
      const text = readFileSync(file, "utf8");
      if (/from\s+["']@\/features\/facturas(\/|["'])/.test(text)) {
        offenders.push(rel);
      }
    }
    expect(offenders, `Importadores legacy:\n${offenders.join("\n")}`).toEqual([]);
  });

  it("queryKeys.ts de facturacion exporta `facturas` y `facturacion`", () => {
    const src = readFileSync(
      join(ROOT, "src/features/facturacion/queryKeys.ts"),
      "utf8",
    );
    expect(src).toMatch(/export\s+const\s+facturas\b/);
    expect(src).toMatch(/export\s+const\s+facturacion\b/);
  });

  it("src/lib/query/index.ts importa `facturas` desde el módulo unificado", () => {
    const src = readFileSync(join(ROOT, "src/lib/query/index.ts"), "utf8");
    expect(src).toMatch(
      /from\s+["']@\/features\/facturacion\/queryKeys["']/,
    );
    expect(src).not.toMatch(/@\/features\/facturas\/queryKeys/);
  });
});
