/**
 * Helpers de recorrido de archivos compartidos por los scripts de auditoría.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface WalkOptions {
  /** Extensiones aceptadas (sin punto). Default: ts, tsx. */
  exts?: string[];
  /** Excluir directorios por nombre exacto. */
  excludeDirs?: string[];
  /** Excluir archivos cuyo basename matchee la regex. */
  excludeFileRe?: RegExp;
}

export function walk(dir: string, opts: WalkOptions = {}, acc: string[] = []): string[] {
  const exts = opts.exts ?? ["ts", "tsx"];
  const excludeDirs = new Set(opts.excludeDirs ?? ["node_modules"]);
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (excludeDirs.has(name)) continue;
      walk(p, opts, acc);
    } else {
      const ext = name.split(".").pop() ?? "";
      if (!exts.includes(ext)) continue;
      if (opts.excludeFileRe && opts.excludeFileRe.test(name)) continue;
      acc.push(p);
    }
  }
  return acc;
}

export function relPath(root: string, p: string): string {
  return relative(root, p).split("\\").join("/");
}
