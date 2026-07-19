/**
 * Guardrail Fase K (v13.301.82) — hardening menor.
 *
 * Blinda que `agente_aprobar_tarifa` **no** incluye el rol `operador` en la lista
 * autorizada. Sólo super_admin y roles administrativos/pricing pueden aprobar o
 * rechazar tarifas de agentes de carga.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readLatestAgenteAprobarMigration(): string {
  const dir = path.resolve(__dirname, "../../../supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const f of files) {
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    if (body.includes("CREATE OR REPLACE FUNCTION public.agente_aprobar_tarifa")) return body;
  }
  throw new Error("No se encontró migración con FUNCTION public.agente_aprobar_tarifa");
}

describe("Fase K — agente_aprobar_tarifa sin operador", () => {
  const sql = readLatestAgenteAprobarMigration();
  const fnBody =
    sql.split("CREATE OR REPLACE FUNCTION public.agente_aprobar_tarifa")[1]?.split("$$;")[0] ?? "";

  it("la última definición no lista 'operador' entre los roles autorizados", () => {
    // Buscar el bloque IN (...) que valida roles en organization_members
    const match = fnBody.match(/om\.role\s+IN\s*\(([^)]+)\)/);
    expect(match, "no se encontró bloque `om.role IN (...)`").not.toBeNull();
    const roles = match![1];
    expect(roles).not.toMatch(/'operador'/);
    // Debe conservar los roles legítimos
    expect(roles).toMatch(/'admin'/);
    expect(roles).toMatch(/'admin_org'/);
    expect(roles).toMatch(/'ejecutivo_pricing'/);
  });

  it("conserva super_admin como bypass", () => {
    expect(fnBody).toMatch(/has_role\(auth\.uid\(\),\s*'super_admin'\)/);
  });

  it("mantiene REVOKE + GRANT authenticated", () => {
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.agente_aprobar_tarifa\(uuid, text, text\) FROM PUBLIC, anon/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.agente_aprobar_tarifa\(uuid, text, text\) TO authenticated/);
  });
});
