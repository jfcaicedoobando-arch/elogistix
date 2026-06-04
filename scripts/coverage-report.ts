/**
 * Resumen de cobertura para CI. Lee `coverage/coverage-summary.json`
 * (generado por `vitest --coverage`) y emite:
 *  - reports/coverage-report.md (resumen humano + top archivos sin cubrir)
 *  - Tabla en consola con totales.
 *
 * No falla el build — los umbrales duros viven en `vitest.config.ts`.
 * Uso: `bun run coverage:report` (corre después de `bun run test:coverage`).
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SUMMARY = join(ROOT, "coverage/coverage-summary.json");
const OUT_DIR = join(ROOT, "reports");
const OUT_MD = join(OUT_DIR, "coverage-report.md");

interface Metric { total: number; covered: number; pct: number }
interface FileSummary { lines: Metric; statements: Metric; functions: Metric; branches: Metric }
type Summary = Record<string, FileSummary> & { total: FileSummary };

function readAppVersion(): string {
  try {
    const src = readFileSync(join(ROOT, "src/constants/appVersion.ts"), "utf8");
    return src.match(/APP_VERSION\s*=\s*["']([^"']+)["']/)?.[1] ?? "unknown";
  } catch { return "unknown"; }
}

function fmt(n: number): string { return `${n.toFixed(1)}%`; }

function main() {
  if (!existsSync(SUMMARY)) {
    console.error(`✗ No existe ${relative(ROOT, SUMMARY)}. Corre primero \`bun run test:coverage\`.`);
    process.exit(1);
  }
  const data = JSON.parse(readFileSync(SUMMARY, "utf8")) as Summary;
  const t = data.total;

  // Top 20 archivos con menor cobertura de líneas (>0 líneas, <100%).
  const files = Object.entries(data)
    .filter(([k]) => k !== "total")
    .map(([file, m]) => ({ file: relative(ROOT, file), pct: m.lines.pct, total: m.lines.total, covered: m.lines.covered }))
    .filter((f) => f.total > 0 && f.pct < 100)
    .sort((a, b) => a.pct - b.pct || b.total - a.total)
    .slice(0, 20);

  const md = `# Coverage Report — ${readAppVersion()}

Generado: ${new Date().toISOString()}

## Totales

| Métrica | Cubierto | Total | % |
|---|---:|---:|---:|
| Líneas | ${t.lines.covered} | ${t.lines.total} | ${fmt(t.lines.pct)} |
| Sentencias | ${t.statements.covered} | ${t.statements.total} | ${fmt(t.statements.pct)} |
| Funciones | ${t.functions.covered} | ${t.functions.total} | ${fmt(t.functions.pct)} |
| Ramas | ${t.branches.covered} | ${t.branches.total} | ${fmt(t.branches.pct)} |

## Top 20 archivos con menor cobertura

| # | Archivo | Líneas cubiertas | % |
|---|---|---:|---:|
${files.map((f, i) => `| ${i + 1} | \`${f.file}\` | ${f.covered}/${f.total} | ${fmt(f.pct)} |`).join("\n")}

---

_Reporte completo HTML: \`coverage/index.html\`. Umbrales mínimos definidos en \`vitest.config.ts\`._
`;

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_MD, md, "utf8");
  console.log(`✔ Coverage report → ${relative(ROOT, OUT_MD)}`);
  console.log(`  lines=${fmt(t.lines.pct)}  stmts=${fmt(t.statements.pct)}  funcs=${fmt(t.functions.pct)}  branches=${fmt(t.branches.pct)}`);
}

main();
