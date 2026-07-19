/**
 * Guardrail Fase P.2 (v13.301.88) — Garantías re-evaluables (state machine).
 *
 * Blinda que la migración P.2 incluya:
 *  - Función `transicion_garantia_valida` con el grafo dirigido.
 *  - Trigger `trg_garantia_transicion_valida` sobre embarque_garantias_contenedor.
 *  - Trigger `trg_garantia_congelar_monto` para bloquear cambios de monto.
 *  - Trigger `trg_garantia_fechas_requeridas` para validar fechas y monto > 0.
 *  - Tabla `embarque_garantias_historial` con GRANTs, RLS y policies scoped por org.
 *  - Trigger `trg_garantia_historial` (AFTER) sobre embarque_garantias_contenedor.
 *  - RPC `set_garantia_estado` SECURITY DEFINER + REVOKE PUBLIC + GRANT restringido.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const MIG_DIR = path.resolve(__dirname, "../../../supabase/migrations");

function readLatestContaining(marker: string): string {
  const files = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const f of files) {
    const body = fs.readFileSync(path.join(MIG_DIR, f), "utf8");
    if (body.includes(marker)) return body;
  }
  throw new Error(`No se encontró migración con marker: ${marker}`);
}

describe("Fase P.2 — Garantías re-evaluables (v13.301.88)", () => {
  const sql = readLatestContaining("set_garantia_estado");

  it("define la función transicion_garantia_valida con el grafo dirigido", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.transicion_garantia_valida/);
    // Debe permitir pendiente -> depositado y pendiente -> retenido
    expect(sql.toLowerCase()).toContain("'pendiente'");
    expect(sql.toLowerCase()).toContain("'depositado'");
    expect(sql.toLowerCase()).toContain("'liberado'");
    expect(sql.toLowerCase()).toContain("'retenido'");
  });

  it("instala trigger de transición válida", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_garantia_transicion_valida[\s\S]*?embarque_garantias_contenedor/,
    );
  });

  it("instala trigger que congela el monto una vez depositada/retenida/liberada", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_garantia_congelar_monto[\s\S]*?embarque_garantias_contenedor/,
    );
    expect(sql.toLowerCase()).toContain("lc_garantia_monto_congelado");
  });

  it("instala trigger de fechas y monto requeridos", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_garantia_fechas_requeridas[\s\S]*?embarque_garantias_contenedor/,
    );
    expect(sql.toLowerCase()).toContain("lc_garantia_fecha_deposito_requerida");
    expect(sql.toLowerCase()).toContain("lc_garantia_fecha_liberacion_requerida");
    expect(sql.toLowerCase()).toContain("lc_garantia_monto_requerido");
  });

  it("crea la tabla embarque_garantias_historial append-only con grants, RLS y policies scoped por org", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.embarque_garantias_historial/);
    expect(sql).toMatch(/GRANT SELECT ON public\.embarque_garantias_historial TO authenticated/);
    expect(sql).toMatch(/GRANT ALL ON public\.embarque_garantias_historial TO service_role/);
    expect(sql).toMatch(
      /ALTER TABLE public\.embarque_garantias_historial ENABLE ROW LEVEL SECURITY/,
    );
    expect(sql).toMatch(/CREATE POLICY "[^"]*"[\s\S]*?ON public\.embarque_garantias_historial/i);
  });


  it("instala trigger AFTER que registra el historial", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_garantia_historial[\s\S]*?AFTER[\s\S]*?embarque_garantias_contenedor/,
    );
  });

  it("expone set_garantia_estado como RPC SECURITY DEFINER con search_path fijo", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.set_garantia_estado\([\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = public/,
    );
  });

  it("revoca PUBLIC y concede EXECUTE sólo a authenticated y service_role", () => {
    expect(sql).toMatch(
      /REVOKE (ALL |EXECUTE )?ON FUNCTION public\.set_garantia_estado[\s\S]*?FROM PUBLIC/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.set_garantia_estado[\s\S]*?TO authenticated/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.set_garantia_estado[\s\S]*?TO service_role/,
    );
  });

  it("valida roles permitidos (admin, admin_org, operador, super_admin)", () => {
    expect(sql).toMatch(/lc_garantia_sin_rol/i);
    expect(sql).toContain("'admin'");
    expect(sql).toContain("'operador'");
    expect(sql).toContain("'super_admin'");
  });
});
