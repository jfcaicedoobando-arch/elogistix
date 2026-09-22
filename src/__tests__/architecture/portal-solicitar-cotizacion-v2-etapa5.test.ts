/**
 * Etapa 5 · guardrail de la migración que agrega identidad de puerto a la
 * solicitud del portal: v2 valida IDs e inserta columnas, v1 delega con NULL y
 * no hay backfill de históricos.
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";

function sqlDeLaMigracion(): string {
  const archivo = readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .find((f) => readFileSync(`${DIR}/${f}`, "utf8").includes("portal_solicitar_cotizacion_v2"));
  expect(archivo, "falta la migración de portal_solicitar_cotizacion_v2").toBeTruthy();
  return readFileSync(`${DIR}/${archivo}`, "utf8");
}

describe("portal_solicitar_cotizacion_v2 · identidad de puerto", () => {
  const sql = sqlDeLaMigracion();

  it("declara los parámetros de puerto opcionales", () => {
    expect(sql).toContain("p_puerto_origen_id uuid DEFAULT NULL");
    expect(sql).toContain("p_puerto_destino_id uuid DEFAULT NULL");
  });

  it("sólo conserva IDs en Marítimo", () => {
    expect(sql).toMatch(/v_pid_origen uuid := CASE WHEN \(p_modo::text = 'Marítimo'\)/);
    expect(sql).toMatch(/v_pid_destino uuid := CASE WHEN \(p_modo::text = 'Marítimo'\)/);
  });

  it("rechaza IDs iguales y puertos inexistentes o inactivos", () => {
    expect(sql).toContain("LC_PORTAL_PUERTOS_IGUALES");
    expect(sql).toContain("LC_PORTAL_PUERTO_INVALIDO");
    expect(sql).toMatch(/FROM public\.puertos pt WHERE pt\.id = v_pid_origen AND pt\.activo/);
    expect(sql).toMatch(/FROM public\.puertos pt WHERE pt\.id = v_pid_destino AND pt\.activo/);
  });

  it("inserta ambas columnas de puerto en cotizaciones", () => {
    expect(sql).toContain("puerto_origen_id, puerto_destino_id");
    expect(sql).toContain("v_pid_origen, v_pid_destino");
  });

  it("v1 delega en v2 con IDs NULL sin duplicar reglas", () => {
    expect(sql).toMatch(/FROM public\.portal_solicitar_cotizacion_v2\([\s\S]*NULL::uuid, NULL::uuid/);
  });

  it("conserva permisos canónicos (sin anon)", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.portal_solicitar_cotizacion_v2[\s\S]*FROM PUBLIC, anon/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.portal_solicitar_cotizacion_v2[\s\S]*TO authenticated/);
  });

  it("no hace backfill ni UPDATE de cotizaciones históricas", () => {
    expect(sql).not.toMatch(/UPDATE\s+public\.cotizaciones/i);
    expect(sql).not.toMatch(/ALTER\s+POLICY|CREATE\s+POLICY|DROP\s+POLICY/i);
  });
});
