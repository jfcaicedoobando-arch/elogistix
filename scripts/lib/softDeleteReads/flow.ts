import type { Env, Query } from "./model.ts";

export function clone(env: Env): Env {
  const copies = new Map<Query, Query>();
  return new Map([...env].map(([name, queries]) => [name, queries.map(query => {
    if (!copies.has(query)) copies.set(query, { ...query });
    return copies.get(query)!;
  })]));
}
export function merge(left: Env | null, right: Env | null): Env | null {
  if (!left) return right;
  if (!right) return left;
  return new Map([...new Set([...left.keys(), ...right.keys()])].map(name => [name,
    [...new Set([...(left.get(name) ?? []), ...(right.get(name) ?? [])])],
  ]));
}
export function replace(env: Env, next: Env): void {
  env.clear();
  for (const [name, values] of next) env.set(name, values);
}
export function consume(queries: Query[]): void {
  for (const query of queries) {
    if (query.mode === "read" && !query.protected) query.origin.unsafe = true;
  }
}

export function finish(env: Env | null): void { if (env) for (const values of env.values()) consume(values); }
