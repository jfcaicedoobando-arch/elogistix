/**
 * Guardrail: ninguna suite SQL de `supabase/tests/` puede quedar huérfana.
 *
 * La auditoría de v13.743.0 encontró 12 archivos `.sql` que existían en el repo
 * pero no los ejecutaba ningún workflow: cobertura ficticia. Este test exige que
 * cada suite esté en el manifiesto bloqueante, en el manifiesto RADAR, o
 * referenciada explícitamente en algún workflow de `.github/workflows/`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR_TESTS = "supabase/tests";
const DIR_WORKFLOWS = ".github/workflows";

function leerManifiesto(ruta: string): string[] {
  return readFileSync(ruta, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

describe("suites SQL referenciadas en CI", () => {
  it("no deja archivos .sql huérfanos", () => {
    const suites = readdirSync(DIR_TESTS)
      // Los archivos `_*.sql` son helpers/catálogos incluidos con \ir.
      .filter((f) => f.endsWith(".sql") && !f.startsWith("_"))
      .map((f) => `${DIR_TESTS}/${f}`);

    expect(suites.length).toBeGreaterThan(40);

    const referencias = [
      ...leerManifiesto(`${DIR_TESTS}/_guards_manifest.txt`),
      ...leerManifiesto(`${DIR_TESTS}/_guards_manifest_radar.txt`),
    ];

    const yaml = readdirSync(DIR_WORKFLOWS)
      .filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"))
      .map((f) => readFileSync(`${DIR_WORKFLOWS}/${f}`, "utf8"))
      .join("\n");

    const huerfanas = suites.filter(
      (s) => !referencias.includes(s) && !yaml.includes(s),
    );

    expect(
      huerfanas,
      `Suites SQL que ningún workflow ejecuta (agrégalas a supabase/tests/_guards_manifest.txt o al manifiesto RADAR): ${huerfanas.join(", ")}`,
    ).toEqual([]);
  });

  it("los manifiestos sólo listan rutas existentes y sin duplicados", () => {
    const rutas = [
      ...leerManifiesto(`${DIR_TESTS}/_guards_manifest.txt`),
      ...leerManifiesto(`${DIR_TESTS}/_guards_manifest_radar.txt`),
    ];
    const duplicadas = rutas.filter((r, i) => rutas.indexOf(r) !== i);
    expect(duplicadas, `Rutas duplicadas: ${duplicadas.join(", ")}`).toEqual([]);

    const existentes = new Set(
      readdirSync(DIR_TESTS)
        .filter((f) => f.endsWith(".sql"))
        .map((f) => `${DIR_TESTS}/${f}`),
    );
    const inexistentes = rutas.filter((r) => !existentes.has(r));
    expect(
      inexistentes,
      `Rutas listadas que no existen: ${inexistentes.join(", ")}`,
    ).toEqual([]);
  });
});
