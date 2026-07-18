/**
 * Guardrail v13.301.69 (Fase A, Bug 2): la RPC `consolidar_proformas` debe
 * repuntar `conceptos_venta.proforma_id` hacia la nueva proforma consolidada.
 * Si un futuro rewrite olvida ese paso, los conceptos quedan huérfanos y el
 * cierre del embarque se bloquea silenciosamente.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

function findLatestConsolidarProformasBody(): string {
  const files = readdirSync(MIGRATIONS_DIR).sort();
  let latest = "";
  for (const f of files) {
    const body = readFileSync(resolve(MIGRATIONS_DIR, f), "utf8");
    if (/FUNCTION\s+public\.consolidar_proformas\b/i.test(body)) {
      latest = body;
    }
  }
  return latest;
}

describe("consolidar_proformas repunta conceptos_venta (guardrail Bug 2)", () => {
  const body = findLatestConsolidarProformasBody();

  it("existe al menos una migración que redefine consolidar_proformas", () => {
    expect(body.length).toBeGreaterThan(0);
  });

  it("la última definición hace UPDATE conceptos_venta SET proforma_id = v_nueva.id", () => {
    expect(body).toMatch(
      /UPDATE\s+public\.conceptos_venta[\s\S]*?SET\s+proforma_id\s*=\s*v_nueva\.id/i,
    );
  });

  it("el UPDATE va acompañado de bypass del guard de embarque cerrado", () => {
    expect(body).toMatch(/set_config\(\s*'app\.bypass_cierre'\s*,\s*'on'/i);
  });
});
