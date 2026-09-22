/**
 * Guardrail del fix CI/RLS: el wrapper v1 de portal_solicitar_cotizacion queda
 * SECURITY INVOKER (sin privilegios propios) y sigue delegando en v2, que
 * conserva SECURITY DEFINER con ancla tenant (client_users / organization_id).
 */
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "supabase/migrations";

function migracionesQueRedefinenV1(): string[] {
  return readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(`${DIR}/${f}`, "utf8"))
    .filter((sql) => /CREATE OR REPLACE FUNCTION public\.portal_solicitar_cotizacion\(/.test(sql));
}

describe("portal_solicitar_cotizacion v1 · wrapper SECURITY INVOKER", () => {
  const versiones = migracionesQueRedefinenV1();
  const ultima = versiones[versiones.length - 1];

  it("la última redefinición de v1 es SECURITY INVOKER", () => {
    expect(ultima).toMatch(
      /CREATE OR REPLACE FUNCTION public\.portal_solicitar_cotizacion\([\s\S]*?SECURITY INVOKER/
    );
    const cuerpoV1 = ultima.slice(ultima.indexOf("public.portal_solicitar_cotizacion("));
    expect(cuerpoV1).not.toContain("SECURITY DEFINER");
  });

  it("v1 sigue delegando en v2 con IDs NULL y sin duplicar reglas", () => {
    expect(ultima).toMatch(
      /FROM public\.portal_solicitar_cotizacion_v2\([\s\S]*NULL::uuid, NULL::uuid/
    );
    expect(ultima).not.toMatch(/check_ratelimit|client_users/);
  });

  it("conserva search_path y permisos canónicos (sin anon)", () => {
    expect(ultima).toContain("SET search_path TO 'public'");
    expect(ultima).toMatch(
      /REVOKE ALL ON FUNCTION public\.portal_solicitar_cotizacion\([\s\S]*FROM PUBLIC, anon/
    );
    expect(ultima).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.portal_solicitar_cotizacion\([\s\S]*TO authenticated/
    );
    expect(ultima).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.portal_solicitar_cotizacion\([\s\S]*TO service_role/
    );
  });

  it("v2 se mantiene SECURITY DEFINER con ancla tenant", () => {
    const sqlV2 = migracionesQueRedefinenV1()
      .concat(
        readdirSync(DIR)
          .filter((f) => f.endsWith(".sql"))
          .sort()
          .map((f) => readFileSync(`${DIR}/${f}`, "utf8"))
      )
      .find((sql) => /CREATE OR REPLACE FUNCTION public\.portal_solicitar_cotizacion_v2\(/.test(sql));
    expect(sqlV2, "falta la migración de v2").toBeTruthy();
    expect(sqlV2).toMatch(
      /portal_solicitar_cotizacion_v2\([\s\S]*?SECURITY DEFINER/
    );
    expect(sqlV2).toMatch(/FROM public\.client_users/);
    expect(sqlV2).toMatch(/organization_id/);
  });
});
