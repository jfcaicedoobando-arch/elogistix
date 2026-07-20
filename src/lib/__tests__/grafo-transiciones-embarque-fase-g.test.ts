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

function readMigration(prefix: string, mustContain?: string): string {
  const dir = path.resolve(__dirname, "../../../supabase/migrations");
  const matches = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith(".sql"))
    .sort();
  for (const m of matches) {
    const contents = fs.readFileSync(path.join(dir, m), "utf8");
    if (!mustContain || contents.includes(mustContain)) return contents;
  }
  throw new Error(`No se encontró la migración con prefijo ${prefix}`);
}

/**
 * Guardrail Fase G actualizado en v13.303.22.
 * - Migración original (20260718214722) sigue creando `assert_transicion_embarque`,
 *   trigger, grants y RAISE.
 * - Migración v13.303.22 redefine `transicion_embarque_valida` con el nuevo grafo
 *   (Arribo → En Aduana, Llegada deprecada). El guardrail apunta a la última
 *   redefinición vigente para verificar aristas del happy path.
 */
describe("Fase G — grafo de transiciones de estado de embarque", () => {
  const sqlOriginal = readMigration("20260718214722");
  const sqlActual = readMigration(
    "20260720",
    "v13.303.22",
  );

  it("crea la función transicion_embarque_valida con firma esperada", () => {
    expect(sqlActual).toMatch(
      /CREATE OR REPLACE FUNCTION public\.transicion_embarque_valida\(\s*p_actual public\.estado_embarque,\s*p_nuevo\s+public\.estado_embarque\s*\)/,
    );
  });

  it("crea la función assert_transicion_embarque", () => {
    expect(sqlOriginal).toMatch(
      /CREATE OR REPLACE FUNCTION public\.assert_transicion_embarque\(/,
    );
  });

  it("Cancelado es terminal (no permite salidas)", () => {
    expect(sqlActual).toMatch(/WHEN 'Cancelado'\s+THEN false/);
  });

  it("Cerrado sólo permite reapertura hacia EIR", () => {
    expect(sqlActual).toMatch(/WHEN 'Cerrado'\s+THEN p_nuevo IN \('EIR'\)/);
  });

  it("permite Cancelar desde cualquier estado no terminal", () => {
    expect(sqlActual).toMatch(
      /IF p_nuevo = 'Cancelado' AND p_actual <> 'Cancelado' THEN\s+RETURN true;/,
    );
  });

  it("permite idempotencia (mismo→mismo)", () => {
    expect(sqlActual).toMatch(/IF p_actual = p_nuevo THEN RETURN true;/);
  });

  it("cubre las aristas del happy path v13.303.22 (Arribo antes de En Aduana)", () => {
    const expectedEdges: Array<[string, RegExp]> = [
      ["Borrador", /WHEN 'Borrador'\s+THEN p_nuevo IN \('Confirmado'\)/],
      ["Cotización", /WHEN 'Cotización'\s+THEN p_nuevo IN \('Confirmado/],
      ["Confirmado", /WHEN 'Confirmado'\s+THEN p_nuevo IN \('En Tránsito/],
      ["En Tránsito", /WHEN 'En Tránsito' THEN p_nuevo IN \('Arribo/],
      ["Arribo", /WHEN 'Arribo'\s+THEN p_nuevo IN \('En Aduana/],
      ["En Aduana", /WHEN 'En Aduana'\s+THEN p_nuevo IN \('Entregado/],
      ["Llegada", /WHEN 'Llegada'\s+THEN p_nuevo IN \('Arribo/],
      ["Entregado", /WHEN 'Entregado'\s+THEN p_nuevo IN \('EIR/],
      ["EIR", /WHEN 'EIR'\s+THEN p_nuevo IN \('Cerrado/],
    ];
    for (const [label, re] of expectedEdges) {
      expect(sqlActual, `arista faltante para ${label}`).toMatch(re);
    }
  });

  it("levanta LC_TRANSICION_INVALIDA con HINT JSON de 4 llaves", () => {
    expect(sqlOriginal).toMatch(/RAISE EXCEPTION 'LC_TRANSICION_INVALIDA/);
    for (const key of [
      "estado_actual",
      "estado_nuevo",
      "expediente",
      "transiciones_permitidas",
    ]) {
      expect(sqlOriginal, `HINT no expone ${key}`).toContain(`'${key}'`);
    }
  });

  it("instala trigger BEFORE UPDATE con WHEN y bypass", () => {
    expect(sqlOriginal).toMatch(
      /CREATE TRIGGER trg_embarque_transicion_valida\s+BEFORE UPDATE OF estado ON public\.embarques/,
    );
    expect(sqlOriginal).toMatch(/WHEN \(OLD\.estado IS DISTINCT FROM NEW\.estado\)/);
    expect(sqlOriginal).toMatch(
      /current_setting\('app\.bypass_transicion', true\)\s*=\s*'on'/,
    );
  });

  it("avanzar_estado_embarque invoca assert_transicion_embarque antes del UPDATE", () => {
    // El PERFORM del assert debe ocurrir antes del UPDATE del estado.
    const idxAssert = sqlOriginal.indexOf(
      "PERFORM public.assert_transicion_embarque(",
    );
    const idxUpdate = sqlOriginal.search(
      /UPDATE embarques\s+SET estado = p_nuevo_estado::estado_embarque/,
    );
    expect(idxAssert).toBeGreaterThan(-1);
    expect(idxUpdate).toBeGreaterThan(idxAssert);
  });

  it("otorga EXECUTE de las funciones de transición sólo a authenticated y service_role", () => {
    expect(sqlOriginal).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.transicion_embarque_valida[^;]+TO authenticated, service_role/,
    );
    expect(sqlOriginal).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.assert_transicion_embarque[^;]+TO authenticated, service_role/,
    );
    expect(sqlOriginal).toMatch(
      /REVOKE ALL ON FUNCTION public\.transicion_embarque_valida[^;]+FROM PUBLIC/,
    );
  });
});
