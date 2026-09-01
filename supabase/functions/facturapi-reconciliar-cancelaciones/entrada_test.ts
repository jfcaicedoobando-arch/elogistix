/**
 * P1-3: cobertura del reparto round-robin del presupuesto global — la parte
 * pura de `cargarPendientes` (sin I/O), expuesta vía `__testonly`.
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { __testonly, PRESUPUESTO_GLOBAL } from "./entrada.ts";

const { repartirRoundRobin } = __testonly;

function ids(n: number, prefix: string): { id: string }[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i + 1}` }));
}

Deno.test("round-robin: un registro en posición 201+ eventualmente se procesa", () => {
  // Simula 2 corridas consecutivas sobre una sola familia con 210 candidatos
  // ya ordenados por cursor (más antiguo primero, tal como los devuelve el
  // SELECT ordenado). La corrida 1 agota el presupuesto en los primeros 180;
  // la corrida 2 — con el cursor ya actualizado — arranca donde quedó.
  const facturas = ids(210, "f");
  const corrida1 = repartirRoundRobin(facturas, [], [], PRESUPUESTO_GLOBAL);
  assertEquals(corrida1.facturas.length, PRESUPUESTO_GLOBAL);
  assertEquals(corrida1.facturas[0].id, "f1");
  assertEquals(corrida1.facturas.at(-1)?.id, "f180");

  // Tras marcar `reconciliacion_checked_at` en los 180 procesados, el SELECT
  // de la siguiente corrida trae primero los 30 restantes (nulls-first).
  const pendientesRestantes = facturas.slice(180);
  const corrida2 = repartirRoundRobin(pendientesRestantes, [], [], PRESUPUESTO_GLOBAL);
  assert(corrida2.facturas.some((f) => f.id === "f201"));
  assertEquals(corrida2.facturas.length, 30);
});

Deno.test("round-robin: NC y REP no se hambrientan cuando facturas domina el backlog", () => {
  const facturas = ids(500, "f");
  const nc = ids(10, "nc");
  const reps = ids(10, "rep");
  const r = repartirRoundRobin(facturas, nc, reps, PRESUPUESTO_GLOBAL);
  // Todas las NC y REP (backlogs pequeños) entran completas — el round-robin
  // les da turno en cada ronda en vez de dejarlas para el final.
  assertEquals(r.notasCredito.length, 10);
  assertEquals(r.reps.length, 10);
  assert(r.facturas.length > 0);
});

Deno.test("round-robin: nunca excede el presupuesto global (suma de las 3 familias)", () => {
  const facturas = ids(300, "f");
  const nc = ids(300, "nc");
  const reps = ids(300, "rep");
  const r = repartirRoundRobin(facturas, nc, reps, PRESUPUESTO_GLOBAL);
  const total = r.facturas.length + r.notasCredito.length + r.reps.length;
  assertEquals(total, PRESUPUESTO_GLOBAL);
});

Deno.test("round-robin: presupuesto no se excede aunque una sola familia tenga todo el backlog", () => {
  const facturas = ids(1000, "f");
  const r = repartirRoundRobin(facturas, [], [], PRESUPUESTO_GLOBAL);
  assertEquals(r.facturas.length, PRESUPUESTO_GLOBAL);
});
