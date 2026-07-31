/**
 * Guardrail Bloque 3.7 (v13.309.21) — Máquina de estados de cotizaciones.
 *
 * Blinda la última migración del trigger `guard_estado_cotizacion`:
 *  - Contiene la excepción `LC_COT_TRANSICION_INVALIDA` con ERRCODE P0001.
 *  - Acepta las transiciones canónicas Borrador→{Enviada,Aceptada,Rechazada},
 *    Enviada→{Aceptada,Rechazada}, Aceptada→En operación.
 *  - Permite Vencida desde cualquier estado no terminal.
 *  - No expone transiciones prohibidas (p.ej. Rechazada→Aceptada, Cerrada→X).
 *  - Fija `search_path` a `public`.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readLatestGuardMigration(): string {
  const dir = path.resolve(__dirname, "../../../supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const f of files) {
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    if (body.includes("CREATE OR REPLACE FUNCTION public.guard_estado_cotizacion")) {
      return body;
    }
  }
  throw new Error("No se encontró migración con guard_estado_cotizacion");
}

describe("Bloque 3.7 — guard_estado_cotizacion transiciones seguras", () => {
  const sql = readLatestGuardMigration();
  const idx = sql.lastIndexOf("CREATE OR REPLACE FUNCTION public.guard_estado_cotizacion");
  const fnEnd = sql.indexOf("$function$;", idx);
  const fnBody = fnEnd > 0 ? sql.slice(idx, fnEnd + "$function$;".length) : sql.slice(idx);

  it("levanta LC_COT_TRANSICION_INVALIDA con ERRCODE P0001", () => {
    expect(fnBody).toMatch(/LC_COT_TRANSICION_INVALIDA/);
    expect(fnBody).toMatch(/ERRCODE\s*=\s*'P0001'/);
  });

  it("fija search_path a public en guard_estado_cotizacion", () => {
    expect(fnBody).toMatch(/SET search_path\s+TO\s+'public'/i);
  });

  it("permite Vencida desde estados no terminales", () => {
    expect(fnBody).toMatch(
      /v_new\s*=\s*'Vencida'\s+AND\s+v_old\s+IN\s*\(\s*'Solicitada'\s*,\s*'Borrador'\s*,\s*'Enviada'\s*,\s*'Aceptada'\s*\)/,
    );
  });

  it("acepta Borrador → {Enviada, Aceptada, Rechazada}", () => {
    expect(fnBody).toMatch(
      /v_old\s*=\s*'Borrador'\s+AND\s+v_new\s+IN\s*\(\s*'Enviada'\s*,\s*'Aceptada'\s*,\s*'Rechazada'\s*\)/,
    );
  });

  it("acepta Enviada → {Aceptada, Rechazada}", () => {
    expect(fnBody).toMatch(
      /v_old\s*=\s*'Enviada'\s+AND\s+v_new\s+IN\s*\(\s*'Aceptada'\s*,\s*'Rechazada'\s*\)/,
    );
  });

  it("acepta Aceptada → En operación", () => {
    expect(fnBody).toMatch(/v_old\s*=\s*'Aceptada'\s+AND\s+v_new\s+IN\s*\(\s*'En operación'\s*\)/);
  });

  it("NO permite transiciones prohibidas explícitamente", () => {
    // Rechazada / En operación / Archivada no aparecen como estado origen con
    // salida hacia Aceptada u otra en la lista blanca. Aserción por ausencia.
    for (const prohibida of [
      "v_old\\s*=\\s*'Rechazada'\\s+AND\\s+v_new\\s+IN[^;]*'Aceptada'",
      "v_old\\s*=\\s*'Archivada'\\s+AND\\s+v_new\\s+IN[^;]*'Aceptada'",
    ]) {
      expect(fnBody).not.toMatch(new RegExp(prohibida));
    }
  });
});
