/**
 * Guardrail de arquitectura — prohíbe valores de color crudos (hex, `rgb()`,
 * `hsl()` con números literales) en el código de la app.
 *
 * El color debe venir del sistema de diseño:
 *   - Clases de Tailwind con tokens semánticos (`bg-primary`, `text-success`).
 *   - Para gráficas (recharts recibe cadenas): `CHART` / `CHART_SERIES` de
 *     `src/lib/chartTokens.ts`, que apuntan a las variables CSS del tema.
 *   - Para documentos PDF/impresión: `COLORS` de `src/pdf/theme/tokens.ts`.
 *
 * Cómo pedir excepción: agregar el path a `ALLOWLIST` con un comentario que
 * explique por qué el valor no puede venir de un token.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = resolve(__dirname, "../../..");

/** Hex (#fff, #ffffff, #ffffffff), rgb()/rgba() y hsl() con números literales. */
const RAW_COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[0-9]|\bhsl\(\s*[0-9]/;

const ALLOWLIST: readonly string[] = [
  // Fuente de tokens de color para documentos PDF (@react-pdf/renderer no
  // puede leer variables CSS): aquí viven los valores hex por diseño.
  "src/pdf/theme/tokens.ts",
  // Página interna de QA de marca: lienzos fijos de identidad (fondos exactos
  // sobre los que se valida el logo), no forma parte del ERP.
  "src/features/marketing/routes/LogoPreview.tsx",
];

describe("architecture — sin valores de color crudos", () => {
  it("solo la allowlist puede usar hex/rgb/hsl literales", () => {
    const violations: { file: string; line: number; match: string }[] = [];

    for (const f of walk(join(ROOT, "src"), {
      excludeDirs: ["__tests__", "node_modules"],
      excludeFileRe: /\.(test|spec)\.tsx?$/,
      includeFileRe: /\.tsx?$/,
    })) {
      const rel = relPath(ROOT, f);
      if (ALLOWLIST.includes(rel)) continue;

      const lines = readFileSync(f, "utf8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(RAW_COLOR);
        if (m) violations.push({ file: rel, line: i + 1, match: m[0] });
      }
    }

    expect(
      violations,
      `Valores de color crudos detectados fuera de la allowlist.\n` +
        `Usa tokens: clases semánticas de Tailwind, `CHART` de @/lib/chartTokens\n` +
        `para gráficas, o `COLORS` de @/pdf/theme/tokens para PDFs.\n\n` +
        violations.map((v) => `  ${v.file}:${v.line} → ${v.match}`).join("\n"),
    ).toEqual([]);
  });
});
