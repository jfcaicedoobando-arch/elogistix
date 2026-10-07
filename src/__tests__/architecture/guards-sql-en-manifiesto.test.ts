/**
 * Guardrail: ninguna suite SQL de `supabase/tests/` puede quedar huérfana.
 *
 * La auditoría de v13.743.0 encontró 12 archivos `.sql` que existían en el repo
 * pero no los ejecutaba ningún workflow: cobertura ficticia. Este test exige que
 * cada suite esté en el manifiesto bloqueante, o
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

function rutasInexistentes(rutas: string[]): string[] {
  // El runner acepta suites anidadas (incluido rls/), no sólo archivos raíz.
  const existentes = new Set(
    readdirSync(DIR_TESTS, { encoding: "utf8", recursive: true })
      .filter((f) => f.endsWith(".sql"))
      .map((f) => `${DIR_TESTS}/${f}`),
  );
  return rutas.filter((r) => !existentes.has(r));
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
      `Suites SQL que ningún workflow ejecuta (agrégalas a supabase/tests/_guards_manifest.txt): ${huerfanas.join(", ")}`,
    ).toEqual([]);
  });

  it("los manifiestos sólo listan rutas existentes y sin duplicados", () => {
    const rutas = [
      ...leerManifiesto(`${DIR_TESTS}/_guards_manifest.txt`),
    ];
    const duplicadas = rutas.filter((r, i) => rutas.indexOf(r) !== i);
    expect(duplicadas, `Rutas duplicadas: ${duplicadas.join(", ")}`).toEqual([]);

    const inexistentes = rutasInexistentes(rutas);
    expect(
      inexistentes,
      `Rutas listadas que no existen: ${inexistentes.join(", ")}`,
    ).toEqual([]);
  });

  it("acepta suites RLS reales y sigue rechazando rutas inexistentes o ajenas", () => {
    const falsas = [
      `${DIR_TESTS}/rls/__guard_inexistente__.sql`,
      `${DIR_TESTS}/../migrations/__guard_inexistente__.sql`,
    ];
    expect(rutasInexistentes([
      `${DIR_TESTS}/rls/test_rls_audit54_pue_tolerancia_cierre.sql`,
      `${DIR_TESTS}/rls/test_rls_audit54_saldo_visible.sql`,
      ...falsas,
    ])).toEqual(falsas);
  });

  it("las trece suites recuperadas y nuevos cobros usan fixtures transaccionales", () => {
    const source = readFileSync(`${DIR_TESTS}/_guards_manifest.txt`, "utf8");
    const section = source.split("# Auditoría de tests 2026-10-03:")[1];
    expect(section, "sección de suites recuperadas presente").toBeDefined();
    const promoted = section.split(/\r?\n/).slice(1).map(line => line.trim()).filter(line => line && !line.startsWith("#"));
    expect(promoted.length).toBeGreaterThanOrEqual(13);
    for (const file of promoted) {
      const sql = readFileSync(file, "utf8");
      expect(sql, `${file}: fixture transaccional`).toMatch(/^BEGIN;/m);
      expect(sql, `${file}: rollback obligatorio`).toMatch(/^ROLLBACK;/m);
    }
  });
});
