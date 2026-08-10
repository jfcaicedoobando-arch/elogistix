/**
 * Helpers de recorrido de archivos compartidos por los scripts de auditoría.
 *
 * v13.474.1 — Rendimiento. Antes se hacía `statSync` por entrada (1 syscall
 * extra por archivo, ~7k syscalls por recorrido) y cada test de arquitectura
 * repetía el recorrido completo. Con ~35 guardrails × 8 forks el I/O saturaba
 * el sandbox y los tests morían por timeout de 15 s. Ahora:
 *   • `readdirSync(withFileTypes)` evita el `statSync`.
 *   • Se memoiza el resultado en `globalThis` (el pool de forks reutiliza el
 *     proceso entre archivos de test, así que el segundo recorrido es O(1)).
 */
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

export interface WalkOptions {
  /** Extensiones aceptadas (sin punto). Default: ts, tsx. */
  exts?: string[];
  /** Excluir directorios por nombre exacto. */
  excludeDirs?: string[];
  /** Excluir archivos cuyo basename matchee la regex. */
  excludeFileRe?: RegExp;
}

type WalkCache = Map<string, string[]>;

function cache(): WalkCache {
  const g = globalThis as typeof globalThis & { __lcWalkCache?: WalkCache };
  g.__lcWalkCache ??= new Map();
  return g.__lcWalkCache;
}

function walkUncached(dir: string, opts: WalkOptions, acc: string[]): string[] {
  const exts = opts.exts ?? ["ts", "tsx"];
  const excludeDirs = new Set(opts.excludeDirs ?? ["node_modules"]);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const name = entry.name;
    const p = join(dir, name);
    if (entry.isDirectory()) {
      if (excludeDirs.has(name)) continue;
      walkUncached(p, opts, acc);
    } else {
      const ext = name.split(".").pop() ?? "";
      if (!exts.includes(ext)) continue;
      if (opts.excludeFileRe && opts.excludeFileRe.test(name)) continue;
      acc.push(p);
    }
  }
  return acc;
}

export function walk(dir: string, opts: WalkOptions = {}, acc: string[] = []): string[] {
  // Sólo cacheamos la forma canónica (sin acumulador precargado).
  if (acc.length > 0) return walkUncached(dir, opts, acc);
  const key = JSON.stringify([
    dir,
    opts.exts ?? null,
    opts.excludeDirs ?? null,
    opts.excludeFileRe ? String(opts.excludeFileRe) : null,
  ]);
  const hit = cache().get(key);
  if (hit) return hit.slice();
  const result = walkUncached(dir, opts, []);
  cache().set(key, result);
  return result.slice();
}


export function relPath(root: string, p: string): string {
  return relative(root, p).split("\\").join("/");
}
