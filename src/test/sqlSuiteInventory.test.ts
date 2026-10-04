// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { expect, it } from "vitest";

it("toda suite SQL raíz está en el manifiesto bloqueante, sin radar ficticio", () => {
  const dir = "supabase/tests";
  const manifest = readFileSync(`${dir}/_guards_manifest.txt`, "utf8")
    .split(/\r?\n/).filter(line => line.trim() && !line.startsWith("#"));
  expect(new Set(manifest).size, "sin entradas duplicadas").toBe(manifest.length);
  const helpers = new Set(["_catalogo_columnas_internas.sql", "_decisiones_negocio.sql"]);
  const suites = readdirSync(dir).filter(file => file.endsWith(".sql") && !helpers.has(file));
  expect(suites.filter(file => !manifest.includes(`${dir}/${file}`)), "suite sin ejecución").toEqual([]);
  const promoted = readFileSync(`${dir}/_guards_manifest.txt`, "utf8")
    .split("# Auditoría de tests 2026-10-03:")[1].split(/\r?\n/).slice(1)
    .filter(line => line.trim() && !line.startsWith("#"));
  expect(promoted.length).toBeGreaterThanOrEqual(13);
  for (const file of promoted) {
    const source = readFileSync(file, "utf8");
    expect(source, `${file}: fixture transaccional`).toMatch(/^BEGIN;/m);
    expect(source, `${file}: rollback obligatorio`).toMatch(/^ROLLBACK;/m);
  }
});
