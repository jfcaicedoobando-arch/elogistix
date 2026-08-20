/**
 * Ola 2 · RN-8 — Todas las rutas del portal de cliente comparten el mismo
 * contenedor (`PortalPageShell`): así el ritmo vertical y el encabezado no se
 * reinventan por página.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "src/features/portal/routes";

describe("RN-8 · rutas del portal con PortalPageShell", () => {
  const archivos = readdirSync(DIR).filter((f) => f.endsWith(".tsx"));

  it("hay rutas de portal que auditar", () => {
    expect(archivos.length).toBeGreaterThan(0);
  });

  for (const f of archivos) {
    it(`${f} usa PortalPageShell`, () => {
      const src = readFileSync(join(DIR, f), "utf8");
      expect(src.includes("PortalPageShell")).toBe(true);
    });
  }
});
