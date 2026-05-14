/**
 * Baseline auditor de "The Power of 10" (ARCHITECTURE.md §20).
 *
 * Reporta violaciones heurísticas por dominio sobre src/. Read-only:
 * NO modifica código. Genera docs/power10-baseline.md.
 *
 * Uso: bunx tsx scripts/audit-power10.ts
 *
 * Heurísticas (sin AST para mantenerlo dependency-free):
 *  - #4 Componentes >200 líneas: cuenta de líneas por archivo .tsx en src/components, src/pages.
 *  - #5/#10 `any` explícito: regex `: any` o `as any` o `<any>` en src/**.
 *  - #3 useEffect sin cleanup: bloque useEffect que invoca .subscribe(/setInterval(/addEventListener( y NO contiene `return` dentro del callback.
 *  - #2 Query de lista sin paginar: hooks de listado (`useEmbarques`, `useClientes`, ...) que llaman `.from(...).select(...)` sin `.range(`/`.limit(`.
 *
 * Las heurísticas son intencionalmente conservadoras: prefieren falsos positivos
 * a omitir violaciones reales. El reporte agrupa por dominio (primer segmento de path).
 */
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

const EXCLUDED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  "ui", // shadcn vendored
  "__tests__",
]);

interface Finding {
  file: string;
  line?: number;
  detail: string;
}

interface Report {
  longComponents: Finding[];
  anyUsage: Finding[];
  effectsNoCleanup: Finding[];
  unboundedQueries: Finding[];
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry)) continue;
      walk(full, acc);
    } else if (/\.(tsx?|ts)$/.test(entry) && !/\.d\.ts$/.test(entry)) {
      // Excluir tipos generados de Supabase y client
      if (full.includes(`integrations${sep}supabase${sep}types.ts`)) continue;
      if (full.includes(`integrations${sep}supabase${sep}client.ts`)) continue;
      acc.push(full);
    }
  }
  return acc;
}

function rel(p: string): string {
  return relative(ROOT, p).split(sep).join("/");
}

function domainOf(p: string): string {
  // src/<bucket>/<dominio>/...
  const r = rel(p);
  const parts = r.split("/");
  if (parts[0] !== "src") return "otros";
  const bucket = parts[1] ?? "raíz";
  if (parts.length >= 3) return `${bucket}/${parts[2]}`;
  return bucket;
}

function checkLongComponents(files: string[], out: Finding[]) {
  for (const f of files) {
    if (!f.endsWith(".tsx")) continue;
    if (!f.includes(`${sep}components${sep}`) && !f.includes(`${sep}pages${sep}`))
      continue;
    const lines = readFileSync(f, "utf8").split("\n").length;
    if (lines > 200) {
      out.push({ file: rel(f), detail: `${lines} líneas` });
    }
  }
}

function checkAny(files: string[], out: Finding[]) {
  const re = /(:\s*any\b|\bas\s+any\b|<any>)/;
  for (const f of files) {
    // Excluir changelog: las descripciones son strings, no `any` reales.
    if (f.includes(`${sep}content${sep}changelog${sep}`)) continue;
    const content = readFileSync(f, "utf8");
    const lines = content.split("\n");
    lines.forEach((ln, i) => {
      // Saltar comentarios obvios
      const trimmed = ln.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;
      // Saltar si la línea anterior tiene un eslint-disable explícito
      const prev = (lines[i - 1] ?? "").trim();
      if (prev.includes("eslint-disable") && prev.includes("no-explicit-any")) return;
      if (re.test(ln)) {
        out.push({ file: rel(f), line: i + 1, detail: ln.trim().slice(0, 120) });
      }
    });
  }
}

function checkEffectsNoCleanup(files: string[], out: Finding[]) {
  // Heurística simple: localizar bloques useEffect(() => { ... }, [...])
  // que contengan .subscribe(/setInterval(/setTimeout(/addEventListener( y
  // NO contengan `return` (cleanup) dentro del bloque.
  const triggers = /(\.subscribe\(|\bsetInterval\(|\bsetTimeout\(|\baddEventListener\()/;
  for (const f of files) {
    const content = readFileSync(f, "utf8");
    const lines = content.split("\n");
    let inEffect = false;
    let depth = 0;
    let startLine = 0;
    let buf: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (!inEffect) {
        if (/\buseEffect\s*\(\s*\(\s*\)\s*=>\s*\{/.test(ln)) {
          inEffect = true;
          depth = (ln.match(/\{/g) ?? []).length - (ln.match(/\}/g) ?? []).length;
          startLine = i + 1;
          buf = [ln];
        }
        continue;
      }
      buf.push(ln);
      depth += (ln.match(/\{/g) ?? []).length;
      depth -= (ln.match(/\}/g) ?? []).length;
      if (depth <= 0) {
        const block = buf.join("\n");
        if (triggers.test(block) && !/\breturn\s+/.test(block)) {
          out.push({
            file: rel(f),
            line: startLine,
            detail: "useEffect con suscripción/timer/listener sin cleanup",
          });
        }
        inEffect = false;
        buf = [];
      }
    }
  }
}

function checkUnboundedQueries(files: string[], out: Finding[]) {
  for (const f of files) {
    if (!f.includes(`${sep}hooks${sep}`) && !f.includes(`${sep}services${sep}`))
      continue;
    const content = readFileSync(f, "utf8");
    // Localizar cadenas .from('x').select(...) que NO contengan .range(/.limit(/.single(/.maybeSingle(/.eq( contra clave única.
    // Buscamos por bloque entre `.from(` y `;` o `await` o `\n\n`.
    const re = /\.from\([^)]+\)\s*\.select\([^;]*?(?=;|await|\n\n|$)/gs;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content))) {
      const chunk = m[0];
      if (/\.range\(|\.limit\(|\.single\(|\.maybeSingle\(/.test(chunk)) continue;
      // Si no usa eq por id/uuid asumimos lista
      const lineNum = content.slice(0, m.index).split("\n").length;
      out.push({
        file: rel(f),
        line: lineNum,
        detail: ".from().select() sin .range/.limit/.single",
      });
    }
  }
}

function groupByDomain(findings: Finding[]): Record<string, Finding[]> {
  const map: Record<string, Finding[]> = {};
  for (const f of findings) {
    const key = domainOf(join(ROOT, f.file));
    (map[key] ??= []).push(f);
  }
  return map;
}

function renderSection(title: string, findings: Finding[], explain: string): string {
  const grouped = groupByDomain(findings);
  const total = findings.length;
  const out: string[] = [`## ${title} (${total})`, "", explain, ""];
  if (total === 0) {
    out.push("_Sin hallazgos._\n");
    return out.join("\n");
  }
  out.push("| Dominio | Hallazgos |");
  out.push("|---|---:|");
  for (const [d, list] of Object.entries(grouped).sort((a, b) => b[1].length - a[1].length)) {
    out.push(`| \`${d}\` | ${list.length} |`);
  }
  out.push("");
  out.push("<details><summary>Detalle</summary>\n");
  for (const f of findings.slice(0, 200)) {
    const loc = f.line ? `:${f.line}` : "";
    out.push(`- \`${f.file}${loc}\` — ${f.detail}`);
  }
  if (findings.length > 200) {
    out.push(`- … (${findings.length - 200} más omitidos)`);
  }
  out.push("\n</details>\n");
  return out.join("\n");
}

function main() {
  const files = walk(SRC);
  const report: Report = {
    longComponents: [],
    anyUsage: [],
    effectsNoCleanup: [],
    unboundedQueries: [],
  };
  checkLongComponents(files, report.longComponents);
  checkAny(files, report.anyUsage);
  checkEffectsNoCleanup(files, report.effectsNoCleanup);
  checkUnboundedQueries(files, report.unboundedQueries);

  const md = [
    "# Power of 10 — Baseline",
    "",
    `_Generado por \`scripts/audit-power10.ts\` sobre ${files.length} archivos de \`src/\`._`,
    "",
    "Las heurísticas son conservadoras (prefieren falsos positivos). Validar manualmente antes de refactorizar. Ver ARCHITECTURE.md §20.",
    "",
    "## Resumen",
    "",
    "| Regla | Hallazgos |",
    "|---|---:|",
    `| #4 Componentes >200 líneas | ${report.longComponents.length} |`,
    `| #5/#10 \`any\` explícito | ${report.anyUsage.length} |`,
    `| #3 \`useEffect\` sin cleanup | ${report.effectsNoCleanup.length} |`,
    `| #2 Queries de lista sin paginar | ${report.unboundedQueries.length} |`,
    "",
    renderSection(
      "Regla #4 — Componentes >200 líneas",
      report.longComponents,
      "Componentes y páginas que superan el umbral. Refactor: extraer `use<X>Controller` + subcomponentes.",
    ),
    renderSection(
      "Regla #5/#10 — `any` explícito",
      report.anyUsage,
      "Reemplazar por tipos generados de Supabase, `unknown` + narrowing, o documentar override según §17.b.",
    ),
    renderSection(
      "Regla #3 — `useEffect` sin cleanup (heurística)",
      report.effectsNoCleanup,
      "Verificar manualmente: bloques con `.subscribe(`/`setInterval(`/`setTimeout(`/`addEventListener(` que parecen no retornar cleanup. Falsos positivos posibles cuando el cleanup vive en función externa.",
    ),
    renderSection(
      "Regla #2 — Queries `.from().select()` sin `.range/.limit/.single`",
      report.unboundedQueries,
      "Aplicable sólo a queries que alimentan listas visibles. Las queries agregadas (KPIs, totales) pueden estar bien sin límite — validar caso por caso.",
    ),
  ].join("\n");

  mkdirSync(join(ROOT, "docs"), { recursive: true });
  const outPath = join(ROOT, "docs", "power10-baseline.md");
  writeFileSync(outPath, md, "utf8");
  console.log(`Baseline escrito en ${rel(outPath)}`);
  console.log(`  #4 long components: ${report.longComponents.length}`);
  console.log(`  #5/#10 any: ${report.anyUsage.length}`);
  console.log(`  #3 effects sin cleanup (heurística): ${report.effectsNoCleanup.length}`);
  console.log(`  #2 queries sin paginar (heurística): ${report.unboundedQueries.length}`);
}

main();
