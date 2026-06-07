/**
 * Auditoría de `as` casts. Puro (sin side-effects).
 * Consumido por `scripts/audit-casts.ts` y `scripts/audit-report.ts`.
 *
 * Reglas de degradación (D16 — 11.64.0):
 *   1. Archivos de test (`__tests__/`, `*.test.{ts,tsx}`, `*.spec.{ts,tsx}`):
 *      HIGH/CRITICAL → MEDIUM. Mocking con `as unknown as X` es práctica
 *      estándar y no representa riesgo de runtime.
 *   2. Línea precedida por `// SAFE-CAST:` (justificación documentada):
 *      HIGH → LOW. Opt-out explícito del desarrollador. Sigue siendo visible
 *      en el reporte pero no inflama el conteo principal.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { walk, relPath } from "./walk";

export type Severity = "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export const WEIGHT: Record<Severity, number> = { SAFE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export interface CastHit {
  file: string;
  line: number;
  snippet: string;
  target: string;
  severity: Severity;
}

function classifyCritical(line: string): Severity | null {
  if (/\bas\s+any\b/.test(line)) return "CRITICAL";
  if (/JSON\.parse\([^)]*\)\s*as\s+/.test(line)) return "CRITICAL";
  return null;
}

function classifySafe(line: string, target: string): Severity | null {
  if (target === "const") return "SAFE";
  if (/^React\./.test(target)) return "SAFE";
  const tail = line.match(/\bas\s+(.+)$/)?.[1] ?? "";
  if (/^ReturnType<typeof/.test(tail)) return "SAFE";
  if (/^Partial<ReturnType<typeof/.test(tail)) return "SAFE";
  if (/^typeof\b/.test(target)) return "SAFE";
  return null;
}

function classifyByTarget(target: string): Severity {
  if (target === "Json") return "LOW";
  if (/^(Tables|TablesInsert|TablesUpdate|Database)\b/.test(target)) return "MEDIUM";
  if (/^[A-Z][A-Za-z0-9_]*\[\]/.test(target)) return "HIGH";
  if (target === "unknown") return "LOW";
  return "MEDIUM";
}

export function classify(line: string, target: string): Severity {
  return (
    classifyCritical(line) ??
    classifySafe(line, target) ??
    (/\bas\s+unknown\s+as\s+/.test(line) ? "HIGH" : classifyByTarget(target))
  );
}

/** Regla 1: test files e infraestructura de test degradan HIGH/CRITICAL → MEDIUM. */
export function isTestFile(rel: string): boolean {
  return (
    /(^|\/)__tests__\//.test(rel) ||
    /\.(test|spec)\.tsx?$/.test(rel) ||
    /(^|\/)src\/test\//.test(rel)
  );
}

/** Regla 2: `// SAFE-CAST:` en la propia línea o hasta 6 líneas arriba degrada HIGH → LOW. */
function hasSafeCastMarker(lines: string[], idx: number): boolean {
  for (let k = idx; k >= Math.max(0, idx - 6); k--) {
    if (/\/\/\s*SAFE-CAST:/.test(lines[k] ?? "")) return true;
  }
  return false;
}

export function applyDowngrades(
  sev: Severity,
  ctx: { isTest: boolean; hasSafeCast: boolean },
): Severity {
  let s = sev;
  if (ctx.isTest && (s === "HIGH" || s === "CRITICAL")) s = "MEDIUM";
  if (ctx.hasSafeCast && s === "HIGH") s = "LOW";
  return s;
}

export function scanCasts(root: string): CastHit[] {
  const hits: CastHit[] = [];
  const re = /\bas\s+([A-Za-z_][A-Za-z0-9_<>[\],.\s|&?]*)/g;
  for (const file of walk(join(root, "src"), { excludeDirs: ["node_modules"] })) {
    const rel = relPath(root, file);
    if (rel.includes("integrations/supabase")) continue;
    if (rel.includes("content/changelog")) continue;
    const isTest = isTestFile(rel);
    const rawLines = readFileSync(file, "utf8").split("\n");
    rawLines.forEach((rawLine, i) => {
      const line = rawLine
        .replace(/\/\/.*$/, "")
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/`(?:[^`\\]|\\.)*`/g, "``");
      let m: RegExpExecArray | null;
      const lineRe = new RegExp(re.source, "g");
      while ((m = lineRe.exec(line)) !== null) {
        const target = m[1].split(/[\s,;)\]}]/)[0].trim();
        if (!target) continue;
        const base = classify(line, target);
        const hasSafeCast = hasSafeCastMarker(rawLines, i);
        const severity = applyDowngrades(base, { isTest, hasSafeCast });
        hits.push({ file: rel, line: i + 1, snippet: rawLine.trim().slice(0, 200), target, severity });
      }
    });
  }
  return hits;
}

export interface CastsSummary {
  total: number;
  bySeverity: Record<Severity, number>;
  topFiles: { file: string; total: number; weight: number; bySev: Record<Severity, number> }[];
  topHits: CastHit[];
}

export function summarizeCasts(hits: CastHit[], opts: { topFiles?: number; topHits?: number } = {}): CastsSummary {
  const bySeverity: Record<Severity, number> = { SAFE: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  const fileWeight = new Map<string, { total: number; weight: number; bySev: Record<Severity, number> }>();
  for (const h of hits) {
    bySeverity[h.severity] += 1;
    const cur = fileWeight.get(h.file) ?? {
      total: 0, weight: 0,
      bySev: { SAFE: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    };
    cur.total += 1;
    cur.weight += WEIGHT[h.severity];
    cur.bySev[h.severity] += 1;
    fileWeight.set(h.file, cur);
  }
  const topFiles = [...fileWeight.entries()]
    .map(([file, w]) => ({ file, ...w }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, opts.topFiles ?? 15);
  const topHits = [...hits]
    .filter((h) => WEIGHT[h.severity] >= 3)
    .sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity])
    .slice(0, opts.topHits ?? 30);
  return { total: hits.length, bySeverity, topFiles, topHits };
}
