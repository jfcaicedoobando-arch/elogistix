/**
 * Auditoría de paginación — clasifica `.from('X').select()` sin
 * `.range/.limit/.single/.maybeSingle` en 3 buckets:
 *
 *   • OK       — devuelve 0-1 fila (eq por PK/FK) o count agregado
 *   • CATALOG  — tabla de catálogo acotado (allowlist)
 *   • RISK     — lista potencialmente larga, candidata a paginar
 *
 * Uso: `bun scripts/audit-pagination.ts` → escribe `docs/pagination-audit.md`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { walk, relPath } from "./lib/walk";

const ROOT = process.cwd();
const ROOTS = ["src/services", "src/hooks"];

const CATALOG_TABLES = new Set([
  // Catálogos estáticos / globales (< ~1000 filas, sin crecimiento operativo)
  "puertos",
  "paises",
  "monedas",
  "incoterms",
  "planes",
  "configuracion",
  "configuracion_global",
  "organizations",
  "organization_members",
  "client_users",
  "catalogos",
  "navieras",
  "tipos_contenedor",
  "proveedores",
  // CRM — tablas de configuración por org (< 100 filas típicamente)
  "crm_etapas_pipeline",
  "crm_motivos_perdida",
  "crm_plantillas_mensaje",
  "crm_cuotas_vendedor",
  "etapas_pipeline",
  "etapas_oportunidad",
]);

// Patrón de "FK lookup" — campos típicos que limitan a 1..N filas hijas
// de un padre concreto. Si el .eq() / .in() usa alguno de estos, marcamos
// como OK (el dataset está acotado por la FK).
const FK_FIELDS = /\b(id|[a-z_]+_id|uuid|expediente|bl_master|bl_house)\b/;


type Bucket = "OK" | "CATALOG" | "RISK";

interface Hit {
  file: string;
  line: number;
  table: string;
  bucket: Bucket;
  reason: string;
  snippet: string;
}

function extractQueryBlock(source: string, fromIdx: number): { block: string; lookahead: string } {
  // Captura desde `.from(` hasta el siguiente `;` para el bloque principal.
  let i = fromIdx;
  let depth = 0;
  let block = "";
  while (i < source.length) {
    const ch = source[i];
    block += ch;
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === ";" && depth <= 0) {
      i++;
      break;
    }
    if (block.length > 1500) break;
    i++;
  }
  // Lookahead: si el query fue `let q = supabase.from(...)`, el `.range()`
  // suele estar 1-30 líneas abajo. Inspeccionamos los siguientes ~2000 chars
  // sin cruzar el final de la función (heurística: parar en línea con sólo `}`).
  let j = i;
  let lookahead = "";
  while (j < source.length && lookahead.length < 2000) {
    const ch = source[j];
    lookahead += ch;
    if (ch === "}" && (source[j + 1] === "\n" || source[j + 1] === "\r" || source[j + 1] === undefined)) {
      // posible cierre de función
      const beforeNewline = lookahead.lastIndexOf("\n", lookahead.length - 2);
      const lineStart = beforeNewline + 1;
      const line = lookahead.slice(lineStart).trim();
      if (line === "}") break;
    }
    j++;
  }
  return { block, lookahead };
}


function classify(block: string, lookahead: string, table: string): { bucket: Bucket; reason: string } {
  const combined = block + lookahead;
  if (/\.(range|limit|single|maybeSingle)\s*\(/.test(block)) {
    return { bucket: "OK", reason: "tiene .range/.limit/.single/.maybeSingle" };
  }
  if (/\.(range|limit|single|maybeSingle)\s*\(/.test(lookahead)) {
    return { bucket: "OK", reason: "paginado en chain split (lookahead)" };
  }
  if (/count:\s*['"](exact|planned|estimated)['"]/.test(combined) && /head:\s*true/.test(combined)) {
    return { bucket: "OK", reason: "count-only (head:true)" };
  }
  if (CATALOG_TABLES.has(table)) {
    return { bucket: "CATALOG", reason: `tabla de catálogo acotado (${table})` };
  }
  const eqMatches = [...combined.matchAll(/\.eq\(\s*['"]([a-z_]+)['"]/g)];
  const inMatches = [...combined.matchAll(/\.in\(\s*['"]([a-z_]+)['"]/g)];
  const allFiltered = [...eqMatches, ...inMatches].map((m) => m[1]);
  if (allFiltered.length > 0) {
    const hasFk = allFiltered.some((f) => FK_FIELDS.test(f));
    if (hasFk) {
      return {
        bucket: "OK",
        reason: `filtro por PK/FK (${allFiltered.join(", ")})`,
      };
    }
  }
  // `.insert(...).select()` siempre devuelve sólo las filas insertadas.
  if (/\.insert\(/.test(block)) {
    return { bucket: "OK", reason: ".insert().select() — sólo filas insertadas" };
  }
  return { bucket: "RISK", reason: "sin .range/.limit ni filtro por PK/FK" };
}




function auditFile(absPath: string, file: string): Hit[] {
  const src = readFileSync(absPath, "utf8");
  const hits: Hit[] = [];
  const re = /\.from\(\s*['"]([a-z_]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const table = m[1];
    const { block } = extractQueryBlock(src, m.index);
    // Sólo nos interesan los que tienen .select() en el mismo encadenamiento
    if (!/\.select\(/.test(block)) continue;
    const lineNo = src.slice(0, m.index).split("\n").length;
    const { bucket, reason } = classify(block, table);
    const snippet = block.replace(/\s+/g, " ").slice(0, 140);
    hits.push({ file, line: lineNo, table, bucket, reason, snippet });
  }
  return hits;
}

const hits: Hit[] = [];
for (const r of ROOTS) {
  const abs = join(ROOT, r);
  for (const f of walk(abs, { excludeFileRe: /\.test\.tsx?$/ })) {
    hits.push(...auditFile(f, relPath(ROOT, f)));
  }
}

const totals = { OK: 0, CATALOG: 0, RISK: 0 };
hits.forEach((h) => totals[h.bucket]++);

const lines: string[] = [];
lines.push("# Auditoría de paginación — buckets OK / CATALOG / RISK");
lines.push("");
lines.push(`> Generado por \`scripts/audit-pagination.ts\`. Total inspeccionado: **${hits.length}** queries.`);
lines.push("");
lines.push("| Bucket | # | Significado |");
lines.push("|--------|--:|-------------|");
lines.push(`| OK | ${totals.OK} | Filtro por PK/FK, count-only, o ya pagina. |`);
lines.push(`| CATALOG | ${totals.CATALOG} | Tabla de catálogo acotado (allowlist). |`);
lines.push(`| RISK | ${totals.RISK} | Sin paginar y sin filtro acotante — candidato a .range/.limit. |`);
lines.push("");
lines.push("## RISK — detalle");
lines.push("");
const risks = hits.filter((h) => h.bucket === "RISK");
if (risks.length === 0) {
  lines.push("✅ Ninguno.");
} else {
  lines.push("| Archivo:línea | Tabla | Snippet |");
  lines.push("|---------------|-------|---------|");
  for (const h of risks) {
    lines.push(`| \`${h.file}:${h.line}\` | \`${h.table}\` | \`${h.snippet}\` |`);
  }
}
lines.push("");
lines.push("## CATALOG — detalle");
lines.push("");
const catalogs = hits.filter((h) => h.bucket === "CATALOG");
if (catalogs.length === 0) {
  lines.push("_Sin hallazgos._");
} else {
  for (const h of catalogs) lines.push(`- \`${h.file}:${h.line}\` — \`${h.table}\``);
}
lines.push("");
lines.push("## OK — sólo conteo por archivo");
lines.push("");
const okByFile = new Map<string, number>();
hits.filter((h) => h.bucket === "OK").forEach((h) => okByFile.set(h.file, (okByFile.get(h.file) ?? 0) + 1));
[...okByFile.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([f, n]) => lines.push(`- \`${f}\` — ${n}`));
lines.push("");

writeFileSync(join(ROOT, "docs/pagination-audit.md"), lines.join("\n"));

console.log(`Total: ${hits.length}  OK=${totals.OK}  CATALOG=${totals.CATALOG}  RISK=${totals.RISK}`);
console.log(`→ docs/pagination-audit.md`);
process.exit(totals.RISK > 0 ? 0 : 0);
