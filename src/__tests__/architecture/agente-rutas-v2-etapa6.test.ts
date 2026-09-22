/**
 * Etapa 6 · guardrail de la migración que agrega identidad global de puertos a
 * las rutas del agente: `get_agente_rutas_v2` devuelve país y UN/LOCODE, conserva
 * el ancla de tenant (agente_users + organization_id) y la v1 no se edita.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";
const V1_FILE = "20260624200800_a8033d85-dc8f-4a14-ba12-91bf975fcab3.sql";

function sqlDeLaMigracion(): string {
  const archivo = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .find((f) => readFileSync(`${DIR}/${f}`, "utf8").includes("get_agente_rutas_v2"));
  expect(archivo, "falta la migración de get_agente_rutas_v2").toBeTruthy();
  return readFileSync(`${DIR}/${archivo}`, "utf8");
}

describe("get_agente_rutas_v2 · identidad global de puertos", () => {
  const sql = sqlDeLaMigracion();

  it("expone país y UN/LOCODE de ambos puertos", () => {
    for (const col of [
      "puerto_origen_code text",
      "puerto_origen_country text",
      "puerto_destino_code text",
      "puerto_destino_country text",
    ]) {
      expect(sql).toContain(col);
    }
    expect(sql).toMatch(/po\.code AS puerto_origen_code/);
    expect(sql).toMatch(/pd\.country AS puerto_destino_country/);
  });

  it("conserva el ancla real de tenant y el modo de ejecución", () => {
    expect(sql).toContain("public.agente_users");
    expect(sql).toMatch(/a\.organization_id = r\.organization_id/);
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("STABLE");
    expect(sql).toContain("SET search_path = public");
  });

  it("aplica permisos canónicos (sin PUBLIC ni anon)", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.get_agente_rutas_v2\(\) FROM PUBLIC, anon/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_agente_rutas_v2\(\) TO authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_agente_rutas_v2\(\) TO service_role/);
  });

  it("no toca la v1, ni tablas de costeo, ni datos históricos", () => {
    expect(sql).not.toMatch(/DROP\s+FUNCTION/i);
    expect(sql).not.toMatch(/FUNCTION public\.get_agente_rutas\(\)/);
    expect(sql).not.toMatch(/ALTER\s+TABLE|UPDATE\s+public\./i);
    expect(sql).not.toMatch(/CREATE\s+POLICY|ALTER\s+POLICY|DROP\s+POLICY/i);
  });

  it("la migración original de la v1 sigue intacta con su firma de 7 columnas", () => {
    const v1 = readFileSync(`${DIR}/${V1_FILE}`, "utf8");
    expect(v1).toContain("CREATE OR REPLACE FUNCTION public.get_agente_rutas()");
    expect(v1).not.toContain("puerto_origen_code");
  });
});
