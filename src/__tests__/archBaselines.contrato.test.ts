/**
 * Contrato de los baselines compartidos (`scripts/lib/archBaselines.ts`):
 * rutas normalizadas, sin duplicados entre sets, y cada entrada corresponde a
 * una violación REAL del escaneo actual. Evita allowlists fantasma.
 */
import { describe, it, expect } from "vitest";
import { runArchAudit } from "../../scripts/lib/arch";
import { ARCH_BASELINES, OVERSIZED_BASELINE } from "../../scripts/lib/archBaselines";

const ROOT = process.cwd();

describe("archBaselines — contrato", () => {
  const todas = Object.entries(ARCH_BASELINES).flatMap(([set, s]) =>
    [...s].map((file) => ({ set, file })),
  );

  it("todas las rutas son relativas al repo, con / y sin ./", () => {
    const malas = todas.filter(
      ({ file }) => !/^src\//.test(file) || file.includes("\\") || file.includes("//"),
    );
    expect(malas, `Rutas no normalizadas:\n${JSON.stringify(malas, null, 2)}`).toEqual([]);
  });

  it("ningún archivo aparece en más de un set", () => {
    const vistos = new Map<string, string>();
    const dups: string[] = [];
    for (const { set, file } of todas) {
      const prev = vistos.get(file);
      if (prev) dups.push(`${file} (${prev} y ${set})`);
      else vistos.set(file, set);
    }
    expect(dups, `Entradas duplicadas:\n${dups.join("\n")}`).toEqual([]);
  });

  it("cada entrada de OVERSIZED_BASELINE es un violador actual", () => {
    const actuales = new Set(runArchAudit(ROOT).oversized.map((o) => o.file));
    const fantasma = [...OVERSIZED_BASELINE].filter((f) => !actuales.has(f)).sort();
    expect(
      fantasma,
      `Ya cumplen el límite de 200 líneas; quítalos de archBaselines.ts:\n${fantasma.join("\n")}`,
    ).toEqual([]);
  });
});
