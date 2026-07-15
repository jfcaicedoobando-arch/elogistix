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

interface Finding { file: string; line: number; table: string; column: string; }

async function main() {
  const schema = parseSchema();
  const files = await fg(["src/**/*.{ts,tsx}"], {
    cwd: ROOT,
    ignore: ["**/*.test.*", "**/*.spec.*", "**/__tests__/**", "src/integrations/supabase/types.ts"],
  });
  const findings: Finding[] = [];

  for (const rel of files) {
    const content = fs.readFileSync(path.join(ROOT, rel), "utf8");
    const lines = content.split("\n");
    // buscar `.from("tabla")` … `.is("col", …)` en una ventana de 20 líneas.
    for (let i = 0; i < lines.length; i++) {
      const fromMatch = lines[i].match(/\.from\(["'`](\w+)["'`]\)/);
      if (!fromMatch) continue;
      const table = fromMatch[1];
      const cols = schema.get(table);
      if (!cols) continue;
      for (let j = i; j < Math.min(i + 30, lines.length); j++) {
        // rompe si aparece otro .from (nueva query)
        if (j > i && /\.from\(["'`]\w+["'`]\)/.test(lines[j])) break;
        const isMatch = lines[j].match(/\.is\(["'`](\w+)["'`]\s*,/);
        if (isMatch && !cols.has(isMatch[1])) {
          findings.push({ file: rel, line: j + 1, table, column: isMatch[1] });
        }
      }
    }
  }

  if (findings.length === 0) {
    console.log("✓ audit:schema — sin mismatches entre .is(...) y schema real.");
    return;
  }
  console.error(`✗ audit:schema — ${findings.length} filtro(s) apuntan a columnas inexistentes:`);
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  .from("${f.table}").is("${f.column}", …) ← columna no existe`);
  }
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
