/**
 * Guard estático — v13.823.61 (test-only)
 *
 * La suite SQL `crm_leads_ownership.sql` congela la topología de policies de
 * `crm_leads`. Este test evita que vuelvan los nombres obsoletos previos a la
 * separación por comando y que se pierda la comparación del conjunto completo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SUITE = readFileSync(
  resolve(process.cwd(), "supabase/tests/crm_leads_ownership.sql"),
  "utf8",
);

const ESPERADAS = [
  "Gestion leads in-org insert crm_leads|a",
  "Gestion leads in-org select crm_leads|r",
  "Gestion leads in-org update crm_leads|w",
  "Lectura in-org crm_leads|r",
  "Vendedor bolsa crm_leads|r",
  "Vendedor own insert crm_leads|a",
  "Vendedor own select crm_leads|r",
  "Vendedor own update crm_leads|w",
];

describe("crm_leads_ownership.sql · topología de policies", () => {
  it("declara las ocho policies permisivas esperadas", () => {
    for (const nombre of ESPERADAS) expect(SUITE).toContain(`'${nombre}'`);
  });

  it("compara el conjunto completo, no un subconjunto por IN", () => {
    expect(SUITE).toContain("AND polpermissive)\n    = ARRAY[");
  });

  it("congela los conteos por comando y la restrictiva de tenant activo", () => {
    expect(SUITE).toContain("count(*) FILTER (WHERE polcmd = 'd') = 0");
    expect(SUITE).toContain("count(*) FILTER (WHERE polcmd = '*') = 0");
    expect(SUITE).toContain("'Scope tenant activo super admin'");
  });

  it("no reintroduce los nombres de las policies FOR ALL eliminadas", () => {
    const usos = SUITE.split("'Gestion leads in-org crm_leads'").length - 1;
    const usosOwn = SUITE.split("'Vendedor own crm_leads'").length - 1;
    // Sólo pueden aparecer dentro de la aserción que prohíbe su regreso.
    expect(usos).toBe(1);
    expect(usosOwn).toBe(1);
    expect(SUITE).toContain("policies FOR ALL obsoletas no deben volver");
  });
});
