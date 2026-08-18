/**
 * Guardrail de arquitectura — Ola C · UI-04: un solo formateador de fechas.
 *
 * La auditoría encontró 9 funciones de formato de fecha duplicadas repartidas
 * por features (cada una con su propio fallback: "—", "s/f", "", el ISO crudo).
 * El canon vive en `src/lib/formatters/dates.ts` (`formatFechaDia`,
 * `formatFechaEs`, `formatFechaHora`, …) y `src/lib/date/*`.
 *
 * Este test falla si un archivo fuera de `src/lib` define su propio
 * formateador de fecha o llama directo a `toLocaleDateString` / `date-fns
 * format(..., "dd/MM/yyyy")`.
 *
 * Cómo pedir excepción: agrega el path a `ALLOWLIST` con el motivo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { walk, relPath } from "../../../scripts/lib/walk";

const ROOT = resolve(__dirname, "../../..");

/** Definición local de un formateador de fecha (function o const arrow). */
const DEFINE_FORMATTER =
  /(?:function|const)\s+(?:fmt|format|formatear)Fecha[A-Za-z]*\s*[(:=]/;

/** Llamadas crudas de formato: bypasean TZ_MX y el fallback canónico. */
const RAW_FORMAT = /\.toLocaleDateString\(|\bformat\(\s*[^,]+,\s*["']dd\/MM\/yyyy["']/;

/**
 * Archivos permitidos. `src/lib` completo queda fuera del barrido (es el canon).
 */
const ALLOWLIST: readonly string[] = [
  // Wrapper documentado: preserva el fallback "s/f" del listado de costos.
  "src/features/embarques/components/costos/grupoCostosProveedorHelpers.ts",
  // Wrapper documentado: validación ISO estricta para los mensajes del DOF.
  "src/features/cxp/hooks/useTcDofPorFecha.ts",
  // Wrappers finos sobre @/lib/formatters para preservar firmas de costeo.
  "src/features/costeo/utils/tarifaFormatters.ts",
];

function violaciones(): { file: string; line: number; match: string }[] {
  const out: { file: string; line: number; match: string }[] = [];
  for (const f of walk(join(ROOT, "src"), {
    excludeDirs: ["__tests__", "node_modules", "lib"],
    excludeFileRe: /\.(test|spec)\.tsx?$/,
  })) {
    const rel = relPath(ROOT, f);
    if (ALLOWLIST.includes(rel)) continue;
    const lines = readFileSync(f, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(DEFINE_FORMATTER) ?? lines[i].match(RAW_FORMAT);
      if (m) out.push({ file: rel, line: i + 1, match: m[0] });
    }
  }
  return out;
}

describe("architecture — formateador de fechas canónico (UI-04)", () => {
  it("ningún módulo define su propio formateador ni llama a toLocaleDateString", () => {
    const v = violaciones();
    expect(
      v,
      "Formateadores de fecha locales detectados. Usa `formatFechaDia`,\n" +
        "`formatFechaEs`, `formatFechaHora` o `formatFechaLarga` de\n" +
        "`@/lib/formatters`, o agrega el archivo a ALLOWLIST en\n" +
        "src/__tests__/architecture/fechas-formateador-canonico.test.ts.\n\n" +
        v.map((x) => `  ${x.file}:${x.line} → ${x.match}`).join("\n"),
    ).toEqual([]);
  });
});
