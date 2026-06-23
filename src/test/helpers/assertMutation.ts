/**
 * Helpers de aserción para mutaciones contra Supabase mockeado.
 *
 * Sprint 1.2 — elimina el anti-patrón "spy sin payload":
 *   expect(spy).toHaveBeenCalled() // ❌ pasa con cualquier basura
 *
 * Reemplazo:
 *   const call = findTableCall(mock, "bbva_movimientos");
 *   assertUpdatePayload(call, { estado_conciliacion: "Conciliado" });
 *
 * El helper lee `opArgs` del `createSupabaseMock` y valida que el payload
 * pasado a `.update(...)` o `.insert(...)` incluya las columnas esperadas.
 * Falla con mensaje claro si la columna falta o el valor no coincide.
 */
import { expect } from "vitest";
import type { TableCall } from "@/services/__tests__/_supabaseChainMock";

interface MockShape {
  tableCalls: TableCall[];
}

export function findTableCall(mock: MockShape, table: string): TableCall {
  const calls = mock.tableCalls.filter((c) => c.table === table);
  if (calls.length === 0) {
    throw new Error(`Ninguna llamada a supabase.from("${table}")`);
  }
  return calls[calls.length - 1]!;
}

function getOpArgs(call: TableCall, op: "update" | "insert" | "upsert"): unknown[] {
  const idx = call.ops.indexOf(op);
  if (idx < 0) {
    throw new Error(
      `Operación "${op}" no fue llamada en ${call.table}. Ops: [${call.ops.join(", ")}]`,
    );
  }
  return call.opArgs[idx] ?? [];
}

/**
 * Valida que `.update(payload)` recibió un objeto que contiene TODAS las
 * columnas en `expected` con los valores indicados. Columnas extra en el
 * payload real son permitidas (subset match).
 */
export function assertUpdatePayload(
  call: TableCall,
  expected: Record<string, unknown>,
): void {
  const args = getOpArgs(call, "update");
  const payload = args[0] as Record<string, unknown> | undefined;
  expect(payload, `update() recibió payload undefined en ${call.table}`).toBeDefined();
  expect(payload).toMatchObject(expected);
}

/** Igual que `assertUpdatePayload` pero para `.insert(payload)`. */
export function assertInsertPayload(
  call: TableCall,
  expected: Record<string, unknown>,
): void {
  const args = getOpArgs(call, "insert");
  const payload = args[0] as Record<string, unknown> | undefined;
  expect(payload, `insert() recibió payload undefined en ${call.table}`).toBeDefined();
  expect(payload).toMatchObject(expected);
}

/** Valida que un `.eq("col", val)` específico se aplicó. */
export function assertEq(call: TableCall, column: string, value: unknown): void {
  const matches = call.ops
    .map((op, i) => ({ op, args: call.opArgs[i] ?? [] }))
    .filter((x) => x.op === "eq" && x.args[0] === column);
  expect(
    matches.length,
    `No se encontró .eq("${column}", ...) en ${call.table}. Ops: [${call.ops.join(", ")}]`,
  ).toBeGreaterThan(0);
  expect(matches.some((m) => m.args[1] === value)).toBe(true);
}
