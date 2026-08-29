/**
 * CLI: audita los `as` casts y genera `docs/cast-audit.md`.
 * Lógica de scan/clasificación en `scripts/lib/casts.ts`.
 *
 * Uso: `bun run audit:casts`.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, relative } from "node:path";
import { scanCasts, summarizeCasts, WEIGHT, type CastHit } from "./lib/casts";

const ROOT = process.cwd();
const OUT = join(ROOT, "docs", "cast-audit.md");

function render(hits: CastHit[]): string {
  const s = summarizeCasts(hits, { topFiles: 15, topHits: 30 });
  const total = s.total;
  const b = s.bySeverity;
  const date = new Date().toISOString().slice(0, 10);

  return `# Cast Audit — generado ${date}

Auditoría automática de los \`as\` casts en \`src/\`. Generado por
\`scripts/audit-casts.ts\`. Para regenerar: \`bun scripts/audit-casts.ts\`.

## Resumen

Total de \`as\` casts detectados: **${total}**

| Categoría | Peso | Cantidad | % |
|-----------|------|----------|---|
| SAFE      | 0 | ${b.SAFE}     | ${((b.SAFE / total) * 100).toFixed(1)}% |
| LOW       | 1 | ${b.LOW}      | ${((b.LOW / total) * 100).toFixed(1)}% |
| MEDIUM    | 2 | ${b.MEDIUM}   | ${((b.MEDIUM / total) * 100).toFixed(1)}% |
| HIGH      | 3 | ${b.HIGH}     | ${((b.HIGH / total) * 100).toFixed(1)}% |
| CRITICAL  | 4 | ${b.CRITICAL} | ${((b.CRITICAL / total) * 100).toFixed(1)}% |

**Lectura clave:** los casts a accionar son los **HIGH + CRITICAL** = ${b.HIGH + b.CRITICAL} (~${(((b.HIGH + b.CRITICAL) / total) * 100).toFixed(1)}%). El resto es seguro o aceptable bajo política.

## Definición de categorías

- **SAFE** — \`as const\`, \`as React.*\`, \`as ReturnType<typeof X>\`. No apagan el chequeo.
- **LOW** — \`as Json\` (wrapper Supabase), \`as unknown\` aislado. Aceptable con comentario.
- **MEDIUM** — \`as Tables<X>\` / \`as TablesInsert<X>\`. Aceptable **solo dentro de \`lib/mappers/*\`**.
- **HIGH** — \`as unknown as X\` (doble cast), \`as X[]\` sobre respuesta sin validar. Reemplazar por parser/type guard.
- **CRITICAL** — \`as any\`, \`JSON.parse(...) as X\`. Eliminar siempre.

## Top-15 archivos por peso de riesgo

| # | Archivo | Total | Peso | SAFE | LOW | MED | HIGH | CRIT |
|---|---------|------:|-----:|-----:|----:|----:|-----:|-----:|
${s.topFiles
  .map(
    (w, i) =>
      `| ${i + 1} | \`${w.file}\` | ${w.total} | ${w.weight} | ${w.bySev.SAFE} | ${w.bySev.LOW} | ${w.bySev.MEDIUM} | ${w.bySev.HIGH} | ${w.bySev.CRITICAL} |`,
  )
  .join("\n")}

## Top-30 casts más riesgosos (HIGH + CRITICAL)

${s.topHits.length === 0
  ? "_Ningún cast HIGH o CRITICAL detectado._"
  : s.topHits
      .map(
        (h, i) =>
          `### ${i + 1}. [${h.severity}] \`${h.file}:${h.line}\`\n\n\`\`\`ts\n${h.snippet}\n\`\`\`\n`,
      )
      .join("\n")}

## Roadmap

Ver [\`docs/strict-mode-roadmap.md\`](./strict-mode-roadmap.md) (cerrado) para el histórico de cómo se llegó a \`strict: true\`.
`;
}

const hits = scanCasts(ROOT);
mkdirSync(join(ROOT, "docs"), { recursive: true });
writeFileSync(OUT, render(hits), "utf8");
console.log(`✔ ${hits.length} casts analizados → ${relative(ROOT, OUT)}`);
// Mantiene compat: variable usada para evitar warning de WEIGHT no-importado.
void WEIGHT;
