/**
 * Audita los `as` casts del proyecto y genera docs/cast-audit.md.
 *
 * Categorías (peso ascendente):
 *   SAFE     0 — `as const`, `as React.*`, `as ReturnType<typeof ...>` en tests
 *   LOW      1 — `as Json` (Supabase wrapper), narrowing DOM
 *   MEDIUM   2 — `as Tables<...>`, `as TablesInsert<...>`, `as TablesUpdate<...>`
 *   HIGH     3 — `as unknown as X`, `as X[]` sobre respuesta sin validar
 *   CRITICAL 4 — `as any`, casts sobre JSON.parse, casts entre tipos no relacionados
 *
 * Uso: `bun scripts/audit-casts.ts` → escribe docs/cast-audit.md
 */
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";

type Severity = "SAFE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
const WEIGHT: Record<Severity, number> = { SAFE: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

interface CastHit {
  file: string;
  line: number;
  snippet: string;
  target: string;
  severity: Severity;
}

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const OUT = join(ROOT, "docs", "cast-audit.md");

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(p);
  }
  return acc;
}

function classify(line: string, target: string): Severity {
  // CRITICAL
  if (/\bas\s+any\b/.test(line)) return "CRITICAL";
  if (/JSON\.parse\([^)]*\)\s*as\s+/.test(line)) return "CRITICAL";
  // SAFE
  if (target === "const") return "SAFE";
  if (/^React\./.test(target)) return "SAFE";
  if (/^ReturnType<typeof/.test(line.match(/\bas\s+(.+)$/)?.[1] ?? "")) return "SAFE";
  if (/^Partial<ReturnType<typeof/.test(line.match(/\bas\s+(.+)$/)?.[1] ?? "")) return "SAFE";
  if (/^typeof\b/.test(target)) return "SAFE";
  // HIGH: doble cast as unknown as X
  if (/\bas\s+unknown\s+as\s+/.test(line)) return "HIGH";
  // LOW: Json wrapper
  if (target === "Json") return "LOW";
  // MEDIUM: tipos de Supabase
  if (/^(Tables|TablesInsert|TablesUpdate|Database)\b/.test(target)) return "MEDIUM";
  // HIGH: as X[] con probable origen Supabase
  if (/^[A-Z][A-Za-z0-9_]*\[\]/.test(target)) return "HIGH";
  // unknown solo (intermedio) — code smell pero no crítico
  if (target === "unknown") return "LOW";
  // Default: MEDIUM (cast a tipo nominal sin validar)
  return "MEDIUM";
}

function scan(): CastHit[] {
  const hits: CastHit[] = [];
  const re = /\bas\s+([A-Za-z_][A-Za-z0-9_<>\[\],.\s|&?]*)/g;
  for (const file of walk(SRC)) {
    const rel = relative(ROOT, file);
    // Excluir tests, types generados, integrations, y contenido de changelog
    // (los changelogs contienen 'as any' dentro de strings de descripción
    // — falsos positivos que no son código ejecutable).
    if (rel.includes("integrations/supabase")) continue;
    if (rel.includes("content/changelog")) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((rawLine, i) => {
      // Quitar comentarios de línea y strings para evitar falsos positivos
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
        const severity = classify(line, target);
        hits.push({
          file: rel,
          line: i + 1,
          snippet: rawLine.trim().slice(0, 200),
          target,
          severity,
        });
      }
    });
  }
  return hits;
}

function render(hits: CastHit[]): string {
  const total = hits.length;
  const bySev = hits.reduce<Record<Severity, number>>(
    (acc, h) => ((acc[h.severity] = (acc[h.severity] ?? 0) + 1), acc),
    { SAFE: 0, LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
  );

  // Top archivos por peso total
  const fileWeight = new Map<string, { total: number; weight: number; bySev: Record<Severity, number> }>();
  for (const h of hits) {
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
    .sort((a, b) => b[1].weight - a[1].weight)
    .slice(0, 15);

  // Top-30 hits más riesgosos
  const topHits = [...hits]
    .filter((h) => WEIGHT[h.severity] >= 3)
    .sort((a, b) => WEIGHT[b.severity] - WEIGHT[a.severity])
    .slice(0, 30);

  const date = new Date().toISOString().slice(0, 10);

  return `# Cast Audit — generado ${date}

Auditoría automática de los \`as\` casts en \`src/\`. Generado por
\`scripts/audit-casts.ts\`. Para regenerar: \`bun scripts/audit-casts.ts\`.

## Resumen

Total de \`as\` casts detectados: **${total}**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | ${bySev.SAFE}     | ${((bySev.SAFE / total) * 100).toFixed(1)}% |
| LOW       | 1 | ${bySev.LOW}      | ${((bySev.LOW / total) * 100).toFixed(1)}% |
| MEDIUM    | 2 | ${bySev.MEDIUM}   | ${((bySev.MEDIUM / total) * 100).toFixed(1)}% |
| HIGH      | 3 | ${bySev.HIGH}     | ${((bySev.HIGH / total) * 100).toFixed(1)}% |
| CRITICAL  | 4 | ${bySev.CRITICAL} | ${((bySev.CRITICAL / total) * 100).toFixed(1)}% |

**Lectura clave:** los casts a accionar son los **HIGH + CRITICAL** = ${bySev.HIGH + bySev.CRITICAL} (~${(((bySev.HIGH + bySev.CRITICAL) / total) * 100).toFixed(1)}%). El resto es seguro o aceptable bajo política.

## Definición de categorías

- **SAFE** — \`as const\`, \`as React.*\`, \`as ReturnType<typeof X>\`. No apagan el chequeo.
- **LOW** — \`as Json\` (wrapper Supabase), \`as unknown\` aislado. Aceptable con comentario.
- **MEDIUM** — \`as Tables<X>\` / \`as TablesInsert<X>\`. Aceptable **solo dentro de \`lib/mappers/*\`**.
- **HIGH** — \`as unknown as X\` (doble cast), \`as X[]\` sobre respuesta sin validar. Reemplazar por parser/type guard.
- **CRITICAL** — \`as any\`, \`JSON.parse(...) as X\`. Eliminar siempre.

## Top-15 archivos por peso de riesgo

| # | Archivo | Total | Peso | SAFE | LOW | MED | HIGH | CRIT |
|---|---------|------:|-----:|-----:|----:|----:|-----:|-----:|
${topFiles
  .map(
    ([f, w], i) =>
      `| ${i + 1} | \`${f}\` | ${w.total} | ${w.weight} | ${w.bySev.SAFE} | ${w.bySev.LOW} | ${w.bySev.MEDIUM} | ${w.bySev.HIGH} | ${w.bySev.CRITICAL} |`,
  )
  .join("\n")}

## Top-30 casts más riesgosos (HIGH + CRITICAL)

${topHits.length === 0
  ? "_Ningún cast HIGH o CRITICAL detectado._"
  : topHits
      .map(
        (h, i) =>
          `### ${i + 1}. [${h.severity}] \`${h.file}:${h.line}\`\n\n\`\`\`ts\n${h.snippet}\n\`\`\`\n`,
      )
      .join("\n")}

## Roadmap

Ver [\`docs/strict-mode-roadmap.md\`](./strict-mode-roadmap.md) para el plan de 4 fases hacia \`strictNullChecks: true\`.
`;
}

const hits = scan();
mkdirSync(join(ROOT, "docs"), { recursive: true });
writeFileSync(OUT, render(hits), "utf8");
// eslint-disable-next-line no-console
console.log(`✔ ${hits.length} casts analizados → ${relative(ROOT, OUT)}`);
