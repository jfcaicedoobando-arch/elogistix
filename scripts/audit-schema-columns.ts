/**
 * Audit: detecta filtros `.is("<columna>", ...)` sobre tablas Supabase donde
 * la columna NO existe en `src/integrations/supabase/types.ts`.
 *
 * Motivación: v13.300.42 — el Dashboard Ejecutivo crasheaba con
 * `column liquidaciones_comision.deleted_at does not exist`. Este linter
 * evita que vuelva a pasar en cualquier query del proyecto.
 *
 * Uso: `bun run tsx scripts/audit-schema-columns.ts` (falla con exit 1 si hay mismatches).
 */
import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";

const ROOT = process.cwd();
const TYPES = path.join(ROOT, "src/integrations/supabase/types.ts");

// Extrae { tabla → Set<columnas> } del bloque `Tables: { <tabla>: { Row: { ... } } }`.
function parseSchema(): Map<string, Set<string>> {
  const src = fs.readFileSync(TYPES, "utf8");
  const tablesMatch = src.match(/Tables:\s*\{([\s\S]*?)\n\s{4}\}\s*\n\s{4}Views:/);
  if (!tablesMatch) throw new Error("No pude localizar el bloque Tables en types.ts");
  const block = tablesMatch[1];
  const out = new Map<string, Set<string>>();
  const tableRe = /^\s{6}(\w+):\s*\{\s*$/gm;
  const positions: { name: string; start: number }[] = [];
  let m;
  while ((m = tableRe.exec(block)) !== null) positions.push({ name: m[1], start: m.index });
  positions.forEach((pos, i) => {
    const end = i + 1 < positions.length ? positions[i + 1].start : block.length;
    const slice = block.slice(pos.start, end);
    const rowMatch = slice.match(/Row:\s*\{([\s\S]*?)\n\s{8}\}/);
    if (!rowMatch) return;
    const cols = new Set<string>();
    for (const line of rowMatch[1].split("\n")) {
      const c = line.match(/^\s+(\w+)(\?)?:/);
      if (c) cols.add(c[1]);
    }
    out.set(pos.name, cols);
  });
  return out;
}

interface Finding { file: string; line: number; table: string; column: string; kind: "is" | "select" }

/**
 * Columnas simples de un `.select("a, b, c")`. Se ignoran embeds y alias
 * (`rel(...)`, `alias:col`, `*`, `!inner`) porque ahí el nombre no es una
 * columna directa de la tabla.
 */
function columnasDeSelect(arg: string): string[] {
  if (arg.includes("(") || arg.includes("*") || arg.includes("$")) return [];
  return arg
    .split(",")
    .map((t) => t.trim())
    .filter((t) => /^\w+$/.test(t));
}

async function main() {
  const schema = parseSchema();
  // v13.824.2: las Edge Functions también entran. Un `aplica_iva` inexistente
  // en `conceptos_factura` tumbó el timbrado completo en producción.
  const files = await fg(["src/**/*.{ts,tsx}", "supabase/functions/**/*.ts"], {
    cwd: ROOT,
    ignore: [
      "**/*.test.*", "**/*.spec.*", "**/__tests__/**", "**/*_test.ts",
      "src/integrations/supabase/types.ts",
    ],
  });
  const findings: Finding[] = [];

  // buscar `.from("tabla")` … `.is("col", …)` / `.select("a, b")` en una ventana.
  const escanearArchivo = (rel: string) => {
    const lines = fs.readFileSync(path.join(ROOT, rel), "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const fromMatch = lines[i].match(/\.from\(["'`](\w+)["'`]\)/);
      if (!fromMatch) continue;
      const cols = schema.get(fromMatch[1]);
      if (!cols) continue;
      escanearVentana(rel, fromMatch[1], cols, lines, i);
    }
  };

  /** Revisa la ventana de 30 líneas posterior a un `.from("tabla")`. */
  const escanearVentana = (rel: string, table: string, cols: Set<string>, lines: string[], inicio: number) => {
    for (let j = inicio; j < Math.min(inicio + 30, lines.length); j++) {
      // rompe si aparece otro `.from(` (nueva query, aunque la tabla venga de
      // una variable o de un ternario: ahí ya no sabemos a qué tabla aplica).
      if (j > inicio && /\.from\(/.test(lines[j])) break;
      const isMatch = lines[j].match(/\.is\(["'`](\w+)["'`]\s*,/);
      if (isMatch && !cols.has(isMatch[1])) {
        findings.push({ file: rel, line: j + 1, table, column: isMatch[1], kind: "is" });
      }
      const selMatch = lines[j].match(/\.select\(\s*["'`]([^"'`]*)["'`]/);
      if (!selMatch) continue;
      for (const col of columnasDeSelect(selMatch[1])) {
        if (!cols.has(col)) findings.push({ file: rel, line: j + 1, table, column: col, kind: "select" });
      }
    }
  };

  for (const rel of files) escanearArchivo(rel);

  if (findings.length === 0) {
    console.log("✓ audit:schema — sin mismatches entre .is(...) / .select(...) y schema real.");
    return;
  }
  console.error(`✗ audit:schema — ${findings.length} referencia(s) a columnas inexistentes:`);
  for (const f of findings) {
    const uso = f.kind === "is" ? `.is("${f.column}", …)` : `.select(… ${f.column} …)`;
    console.error(`  ${f.file}:${f.line}  .from("${f.table}")${uso} ← columna no existe`);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
