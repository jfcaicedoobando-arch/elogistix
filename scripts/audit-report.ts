/**
 * Reporte CI consolidado (Bloque D15, 11.62.0).
 *
 * Agrega:
 *  - Violaciones de capa (imports directos a Supabase, oversized > 200).
 *  - Casts HIGH + CRITICAL (top archivos).
 *  - Higiene de tests (skip/only/todo sin issue, duplicados).
 *
 * Emite:
 *  - reports/audit-report.md  (resumen humano + tablas + top issues)
 *  - reports/audit-report.json (máquina-legible)
 *
 * Exit code 0 siempre — informativo. Los gates duros viven en
 * `architecture-baseline.test.ts` y `audit:tests`.
 *
 * Uso: `bun scripts/audit-report.ts` o `bun run audit:report`.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { runArchAudit } from "./lib/arch";
import { scanCasts, summarizeCasts, type CastsSummary } from "./lib/casts";
import { auditTests, type TestViolation } from "./lib/tests";
import { scanFromDbAdoption, type FromDbAdoption } from "./lib/fromDbAdoption";

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, "reports");
const OUT_MD = join(OUT_DIR, "audit-report.md");
const OUT_JSON = join(OUT_DIR, "audit-report.json");

interface ReportShape {
  version: string;
  generatedAt: string;
  arch: ReturnType<typeof runArchAudit>;
  casts: {
    total: number;
    bySeverity: CastsSummary["bySeverity"];
    topFiles: { file: string; total: number; weight: number }[];
  };
  tests: { violations: TestViolation[] };
  fromDb: FromDbAdoption;
}

function readAppVersion(): string {
  try {
    const src = readFileSync(join(ROOT, "src/constants/appVersion.ts"), "utf8");
    return src.match(/APP_VERSION\s*=\s*["']([^"']+)["']/)?.[1] ?? "unknown";
  } catch { return "unknown"; }
}

function renderMd(r: ReportShape): string {
  const { arch, casts, tests, fromDb } = r;
  const archOk = arch.hooksContextsDirectImports.length === 0 && arch.componentsPagesDirectImports.length === 0 && arch.oversized.length === 0;
  const testsOk = tests.violations.length === 0;
  const castsHC = casts.bySeverity.HIGH + casts.bySeverity.CRITICAL;
  return `# Audit Report — ${r.version}

Generado: ${r.generatedAt}

## Resumen

| Sección | Estado | Detalle |
|---|---|---|
| Capa (Supabase directo en hooks/contexts) | ${arch.hooksContextsDirectImports.length === 0 ? "✅" : "❌"} | ${arch.hooksContextsDirectImports.length} archivos |
| Capa (Supabase directo en components/pages) | ${arch.componentsPagesDirectImports.length === 0 ? "✅" : "❌"} | ${arch.componentsPagesDirectImports.length} archivos |
| Power-of-10 (>200 líneas) | ${arch.oversized.length === 0 ? "✅" : "❌"} | ${arch.oversized.length} archivos |
| Casts HIGH + CRITICAL | ${castsHC === 0 ? "✅" : "⚠️"} | ${castsHC} / ${casts.total} |
| Higiene de tests | ${testsOk ? "✅" : "❌"} | ${tests.violations.length} violaciones |
| Adopción zod en \`fromDb\` | ${fromDb.sinSchema === 0 ? "✅" : "⚠️"} | ${fromDb.conSchema}/${fromDb.total} validados (${Math.round(fromDb.ratio * 100)}%) |

## Arquitectura

### Hooks/Contexts con import directo a Supabase
${arch.hooksContextsDirectImports.length === 0 ? "✅ Ninguno" : arch.hooksContextsDirectImports.map((f) => `- \`${f}\``).join("\n")}

### Components/Pages con import directo a Supabase
${arch.componentsPagesDirectImports.length === 0 ? "✅ Ninguno" : arch.componentsPagesDirectImports.map((f) => `- \`${f}\``).join("\n")}

### Archivos productivos > 200 líneas
${arch.oversized.length === 0 ? "✅ Ninguno" : arch.oversized.map((o) => `- ${o.lines.toString().padStart(4)}  \`${o.file}\``).join("\n")}

## Casts

Total: **${casts.total}** — HIGH: **${casts.bySeverity.HIGH}**, CRITICAL: **${casts.bySeverity.CRITICAL}**

| Severidad | Cantidad |
|---|---:|
| SAFE | ${casts.bySeverity.SAFE} |
| LOW | ${casts.bySeverity.LOW} |
| MEDIUM | ${casts.bySeverity.MEDIUM} |
| HIGH | ${casts.bySeverity.HIGH} |
| CRITICAL | ${casts.bySeverity.CRITICAL} |

### Top-10 archivos por peso de riesgo

| # | Archivo | Total | Peso |
|---|---|---:|---:|
${casts.topFiles.slice(0, 10).map((f, i) => `| ${i + 1} | \`${f.file}\` | ${f.total} | ${f.weight} |`).join("\n")}

## Boundaries de datos (\`fromDb\`)

Call sites validados con zod: **${fromDb.conSchema}** de **${fromDb.total}** (${Math.round(fromDb.ratio * 100)}%).

${fromDb.sinSchema === 0 ? "✅ Sin casts crudos." : `Casts crudos \`fromDb<T>()\` pendientes por feature:

| Feature | Pendientes |
|---|---:|
${Object.entries(fromDb.porFeature).sort((a, b) => b[1] - a[1]).map(([f, n]) => `| \`${f}\` | ${n} |`).join("\n")}`}

## Tests

${testsOk ? "✅ Sin violaciones." : tests.violations.map((v) => `- [${v.rule}] \`${v.file}:${v.line}\` — ${v.detail}`).join("\n")}

---

_Estado general: ${archOk && testsOk ? "✅ Baseline arquitectónico limpio" : "⚠️ Revisar violaciones arriba"}._
`;
}

function main() {
  const arch = runArchAudit(ROOT);
  const castHits = scanCasts(ROOT);
  const castsSummary = summarizeCasts(castHits, { topFiles: 10, topHits: 0 });
  const testsViolations = auditTests(ROOT);
  const fromDbAdoption = scanFromDbAdoption(ROOT);

  const report: ReportShape = {
    version: readAppVersion(),
    generatedAt: new Date().toISOString(),
    arch,
    casts: {
      total: castsSummary.total,
      bySeverity: castsSummary.bySeverity,
      topFiles: castsSummary.topFiles.map((f) => ({ file: f.file, total: f.total, weight: f.weight })),
    },
    tests: { violations: testsViolations },
    fromDb: fromDbAdoption,
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_JSON, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(OUT_MD, renderMd(report), "utf8");

  console.log(`✔ Audit report → ${relative(ROOT, OUT_MD)} + ${relative(ROOT, OUT_JSON)}`);
  console.log(`  arch: ${arch.hooksContextsDirectImports.length + arch.componentsPagesDirectImports.length} import violations, ${arch.oversized.length} oversized`);
  console.log(`  casts: ${castsSummary.bySeverity.HIGH} HIGH, ${castsSummary.bySeverity.CRITICAL} CRITICAL (de ${castsSummary.total})`);
  console.log(`  tests: ${testsViolations.length} violaciones de higiene`);
  console.log(`  fromDb: ${fromDbAdoption.conSchema}/${fromDbAdoption.total} boundaries validados con zod`);
}

main();
