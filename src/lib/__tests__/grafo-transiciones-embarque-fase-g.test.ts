/**
 * Guardrail Fase G (v13.301.78) — grafo de transiciones de estado de embarque.
 *
 * Bloquea que futuras migraciones aflojen las aristas del ciclo de vida del
 * embarque (Bug 12 de la auditoría, Ronda 2). Verifica la migración
 * `20260718214722_*.sql`:
 *   - Funciones `transicion_embarque_valida` y `assert_transicion_embarque`.
 *   - Estados terminales/reapertura codificados (Cancelado, Cerrado→EIR).
 *   - Trigger `trg_embarque_transicion_valida` con `WHEN` y bypass.
 *   - Reescritura de `avanzar_estado_embarque` invocando el assert.
 *   - Marcador `LC_TRANSICION_INVALIDA` con HINT JSON estructurado.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readMigration(): string {
  const dir = path.resolve(__dirname, "../../../supabase/migrations");
  const match = fs
    .readdirSync(dir)
    .find((f) => f.startsWith("20260718214722") && f.endsWith(".sql"));
  if (!match) {
    throw new Error(
      "No se encontró la migración del grafo de transiciones (20260718214722_*.sql)",
    );
  }
  return fs.readFileSync(path.join(dir, match), "utf8");
}

describe("Fase G — grafo de transiciones de estado de embarque", () => {
  const sql = readMigration();

  it("crea la función transicion_embarque_valida con firma esperada", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.transicion_embarque_valida\(\s*p_actual public\.estado_embarque,\s*p_nuevo\s+public\.estado_embarque\s*\)/,
    );
  });

  it("crea la función assert_transicion_embarque", () => {
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.assert_transicion_embarque\(/,
    );
  });

  it("Cancelado es terminal (no permite salidas)", () => {
    expect(sql).toMatch(/WHEN 'Cancelado'\s+THEN false/);
  });

  it("Cerrado sólo permite reapertura hacia EIR", () => {
    expect(sql).toMatch(/WHEN 'Cerrado'\s+THEN p_nuevo IN \('EIR'\)/);
  });

  it("permite Cancelar desde cualquier estado no terminal", () => {
    expect(sql).toMatch(
      /IF p_nuevo = 'Cancelado' AND p_actual <> 'Cancelado' THEN\s+RETURN true;/,
    );
  });

  it("permite idempotencia (mismo→mismo)", () => {
    expect(sql).toMatch(/IF p_actual = p_nuevo THEN RETURN true;/);
  });

  it("cubre las aristas del happy path (10 estados)", () => {
    const expectedEdges: Array<[string, RegExp]> = [
      ["Borrador", /WHEN 'Borrador'\s+THEN p_nuevo IN \('Cotización'/],
      ["Cotización", /WHEN 'Cotización'\s+THEN p_nuevo IN \('Confirmado/],
      ["Confirmado", /WHEN 'Confirmado'\s+THEN p_nuevo IN \('En Tránsito/],
      ["En Tránsito", /WHEN 'En Tránsito' THEN p_nuevo IN \('En Aduana/],
      ["En Aduana", /WHEN 'En Aduana'\s+THEN p_nuevo IN \('Llegada/],
      ["Llegada", /WHEN 'Llegada'\s+THEN p_nuevo IN \('Arribo/],
      ["Arribo", /WHEN 'Arribo'\s+THEN p_nuevo IN \('Entregado/],
      ["Entregado", /WHEN 'Entregado'\s+THEN p_nuevo IN \('EIR/],
      ["EIR", /WHEN 'EIR'\s+THEN p_nuevo IN \('Cerrado/],
    ];
    for (const [label, re] of expectedEdges) {
      expect(sql, `arista faltante para ${label}`).toMatch(re);
    }
  });

  it("levanta LC_TRANSICION_INVALIDA con HINT JSON de 4 llaves", () => {
    expect(sql).toMatch(/RAISE EXCEPTION 'LC_TRANSICION_INVALIDA/);
    for (const key of [
      "estado_actual",
      "estado_nuevo",
      "expediente",
      "transiciones_permitidas",
    ]) {
      expect(sql, `HINT no expone ${key}`).toContain(`'${key}'`);
    }
  });

  it("instala trigger BEFORE UPDATE con WHEN y bypass", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_embarque_transicion_valida\s+BEFORE UPDATE OF estado ON public\.embarques/,
    );
    expect(sql).toMatch(/WHEN \(OLD\.estado IS DISTINCT FROM NEW\.estado\)/);
    expect(sql).toMatch(
      /current_setting\('app\.bypass_transicion', true\)\s*=\s*'on'/,
    );
  });

  it("avanzar_estado_embarque invoca assert_transicion_embarque antes del UPDATE", () => {
    // El PERFORM del assert debe ocurrir antes del UPDATE del estado.
    const idxAssert = sql.indexOf(
      "PERFORM public.assert_transicion_embarque(",
    );
    const idxUpdate = sql.search(
      /UPDATE embarques\s+SET estado = p_nuevo_estado::estado_embarque/,
    );
    expect(idxAssert).toBeGreaterThan(-1);
    expect(idxUpdate).toBeGreaterThan(idxAssert);
  });

  it("otorga EXECUTE de las funciones de transición sólo a authenticated y service_role", () => {
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.transicion_embarque_valida[^;]+TO authenticated, service_role/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.assert_transicion_embarque[^;]+TO authenticated, service_role/,
    );
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.transicion_embarque_valida[^;]+FROM PUBLIC/,
    );
  });
});
