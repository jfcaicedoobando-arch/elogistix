/**
 * Blinda Fase 1 item #2: roto el ciclo admin ↔ configuracion.
 * `configuracion` no puede volver a importar de `admin`.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = process.cwd();

describe("Fase 1 #2 — ciclo admin ↔ configuracion", () => {
  it("ningún archivo en features/configuracion importa de @/features/admin", () => {
    const offenders: string[] = [];
    const dir = join(ROOT, "src/features/configuracion");
    for (const file of walk(dir)) {
      const text = readFileSync(file, "utf8");
      if (/from\s+["']@\/features\/admin(\/|["'])/.test(text)) {
        offenders.push(relPath(ROOT, file));
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("TabExportar vive en features/admin, no en features/configuracion", () => {
    expect(existsSync(join(ROOT, "src/features/admin/components/TabExportar.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "src/features/configuracion/components/TabExportar.tsx"))).toBe(false);
  });

  it("features/admin/routes/admin-org/Configuracion.tsx importa TabExportar desde la ruta nueva", () => {
    const src = readFileSync(join(ROOT, "src/features/admin/routes/admin-org/Configuracion.tsx"), "utf8");
    expect(src).toMatch(/from\s+["']@\/features\/admin\/components\/TabExportar["']/);
  });
});
