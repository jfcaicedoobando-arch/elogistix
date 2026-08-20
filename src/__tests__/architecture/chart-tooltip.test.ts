/**
 * Guardarraíl RN-2 (Ola 2) — un solo tooltip para todas las gráficas.
 *
 * El `<Tooltip>` de recharts pinta un recuadro blanco con estilos inline: en
 * modo oscuro queda ilegible y nunca respeta los tokens del design system.
 * Por eso todo `<Tooltip>` de recharts debe recibir `content={<ChartTooltip …>}`
 * y ningún archivo puede volver a estilizarlo con `contentStyle`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = resolve(__dirname, "../../..");

/**
 * Ola C · C.4 (R3-V-4) — colapsa saltos de línea para que un prop escrito en
 * varias líneas (`content={\n  <ChartTooltip …>}`) no esquive la detección.
 */
function normalizar(src: string): string {
  return src.replace(/\s+/g, " ");
}

function archivosTsx(): string[] {
  const out: string[] = [];
  for (const f of walk(join(ROOT, "src"), {
    excludeDirs: ["__tests__", "node_modules"],
    excludeFileRe: /\.(test|spec)\.tsx?$/,
  })) {
    if (f.endsWith(".tsx")) out.push(f);
  }
  return out;
}

describe("architecture — ChartTooltip único (RN-2)", () => {
  it("ningún <Tooltip> de recharts se usa sin ChartTooltip", () => {
    const ofensores: string[] = [];
    for (const f of archivosTsx()) {
      const src = normalizar(readFileSync(f, "utf8"));
      if (!src.includes('from "recharts"')) continue;
      if (!src.includes("<Tooltip")) continue;
      if (!src.includes("content={ <ChartTooltip") && !src.includes("content={<ChartTooltip")) {
        ofensores.push(relPath(ROOT, f));
      }
    }
    expect(
      ofensores,
      "Usa <Tooltip content={<ChartTooltip />} /> de @/components/shared/ChartTooltip:\n" +
        ofensores.join("\n"),
    ).toEqual([]);
  });

  it("ninguna gráfica define contentStyle a mano", () => {
    const ofensores: string[] = [];
    for (const f of archivosTsx()) {
      const src = readFileSync(f, "utf8");
      if (src.includes("contentStyle")) ofensores.push(relPath(ROOT, f));
    }
    expect(ofensores).toEqual([]);
  });
});
