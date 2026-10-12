// Mock thenable local: evalúa filtros, orden y límite; registra updates en memoria.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { cargarFacturas } from "../satBarrido.ts";
import type { Fixture } from "./satBarridoSoftDeleteFixtures.ts";

export type AdminClient = Parameters<typeof cargarFacturas>[0];

interface UpdateRecord {
  ids: string[];
  patch: Record<string, unknown>;
}

type QueryResult = { data: Fixture[]; error: null };
type OrderSpec = {
  column: string;
  ascending: boolean;
  nullsFirst: boolean;
};

function valor(row: Fixture, column: string): unknown {
  return column.split(".").reduce<unknown>((value, part) => {
    if (value === null || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[part];
  }, row);
}

/**
 * Subconjunto de PostgREST usado por estos selectores y su persistencia.
 * Los filtros se ejecutan antes de order/limit aunque se añadan después.
 * No sustituye a una prueba de integración de Supabase/RLS.
 */
class FixtureQuery implements PromiseLike<QueryResult> {
  rows: Fixture[];
  updates: UpdateRecord[];
  predicates: Array<(row: Fixture) => boolean> = [];
  orders: OrderSpec[] = [];
  maxRows: number | undefined;
  patch: Record<string, unknown> | undefined;

  constructor(rows: Fixture[], updates: UpdateRecord[]) {
    this.rows = rows;
    this.updates = updates;
  }

  select(_columns: string): this {
    return this;
  }

  eq(column: string, expected: unknown): this {
    this.predicates.push((row) => valor(row, column) === expected);
    return this;
  }

  not(column: string, operator: string, expected: unknown): this {
    assertEquals(operator, "is");
    this.predicates.push((row) => valor(row, column) !== expected);
    return this;
  }

  neq(column: string, expected: unknown): this {
    this.predicates.push((row) => {
      const actual = valor(row, column);
      return actual !== null && actual !== undefined && actual !== expected;
    });
    return this;
  }

  is(column: string, expected: unknown): this {
    this.predicates.push((row) => valor(row, column) === expected);
    return this;
  }

  in(column: string, expected: unknown[]): this {
    this.predicates.push((row) => expected.includes(valor(row, column)));
    return this;
  }

  order(column: string, options: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orders.push({
      column,
      ascending: options.ascending ?? true,
      nullsFirst: options.nullsFirst ?? false,
    });
    return this;
  }

  limit(count: number): this {
    this.maxRows = count;
    return this;
  }

  update(patch: Record<string, unknown>): this {
    this.patch = patch;
    return this;
  }

  execute(): QueryResult {
    let selected = this.rows.filter((row) => this.predicates.every((predicate) => predicate(row)));
    selected.sort((a, b) => {
      for (const order of this.orders) {
        const left = valor(a, order.column);
        const right = valor(b, order.column);
        if (left === right) continue;
        if (left === null || left === undefined) return order.nullsFirst ? -1 : 1;
        if (right === null || right === undefined) return order.nullsFirst ? 1 : -1;
        const comparison = String(left) < String(right) ? -1 : 1;
        return order.ascending ? comparison : -comparison;
      }
      return 0;
    });
    if (this.maxRows !== undefined) selected = selected.slice(0, this.maxRows);
    if (this.patch !== undefined) {
      this.updates.push({ ids: selected.map((row) => row.id), patch: { ...this.patch } });
      for (const row of selected) Object.assign(row, this.patch);
    }
    return { data: structuredClone(selected), error: null };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

export function mockAdmin(fixtures: Fixture[]) {
  const rows = structuredClone(fixtures);
  const updates: UpdateRecord[] = [];
  const admin = {
    from(table: string) {
      assertEquals(table, "proveedor_facturas");
      return new FixtureQuery(rows, updates);
    },
  } as unknown as AdminClient;
  return { admin, rows, updates };
}

