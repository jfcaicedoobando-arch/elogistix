/**
 * Regresión (13.401.3): el buscador global ya rompió dos veces las reglas de
 * calidad — primero por pasar de 200 líneas (Power of 10 #4) y después por
 * exportar constantes desde un archivo de componentes (react-refresh).
 *
 * Este test fija ambos candados para que el baseline de arquitectura no vuelva
 * a romperse sin que alguien lo note en CI.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LIMITE_LINEAS = 200;

const ARCHIVOS = [
  "src/components/shared/GlobalSearch.tsx",
  "src/components/shared/GlobalSearch.partes.tsx",
  "src/components/shared/globalSearchMeta.ts",
  "src/components/shared/globalSearchResaltado.ts",
] as const;

function leer(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function contarLineas(rel: string): number {
  return leer(rel).split("\n").filter((l, i, arr) => i < arr.length - 1 || l.length > 0).length;
}

describe("GlobalSearch · candados de arquitectura", () => {
  for (const rel of ARCHIVOS) {
    it(`${rel} se mantiene bajo ${LIMITE_LINEAS} líneas`, () => {
      expect(contarLineas(rel)).toBeLessThanOrEqual(LIMITE_LINEAS);
    });
  }

  it("GlobalSearch.partes.tsx sólo exporta componentes (Fast Refresh)", () => {
    const src = leer("src/components/shared/GlobalSearch.partes.tsx");
    const exportsNoComponente = [...src.matchAll(/^export\s+(?:const|let|var)\s+(\w+)/gm)]
      .map((m) => m[1])
      // Un componente válido empieza con mayúscula; constantes como ICONO_FILA
      // o mapas como typeIcons deben vivir en `globalSearchMeta.ts`.
      .filter((nombre) => !/^[A-Z][a-z]/.test(nombre));
    expect(exportsNoComponente).toEqual([]);
  });

  it("las constantes compartidas viven en globalSearchMeta.ts", () => {
    const meta = leer("src/components/shared/globalSearchMeta.ts");
    for (const nombre of ["ICONO_FILA", "typeIcons", "typeLabels"]) {
      expect(meta).toContain(`export const ${nombre}`);
    }
  });
});
