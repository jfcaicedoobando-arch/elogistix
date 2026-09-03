/**
 * RBD-04 · Guardrail: todo archivo de `supabase/schema/**` debe ser SQL
 * revisable como función completa: contener `CREATE OR REPLACE FUNCTION
 * public.<f>(…)`. Caso que lo motiva: `schema/cxp/regenerar_movimiento_pago_proveedor.sql`
 * empezaba directo en `RETURNS uuid` (encabezado truncado), inválido como SQL
 * y rompiendo el diff mecánico contra su migración.
 *
 * Uso: `bun run audit:schema-functions`. Exit 1 si algún archivo no cumple.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCHEMA_DIR = path.join(ROOT, "supabase", "schema");
/** `baseline.sql` es un dump completo del esquema, no una función canónica. */
const EXENTOS = new Set<string>(["supabase/schema/baseline.sql"]);
/** `schema/squash/*.sql` son dumps consolidados del esquema, no funciones. */
/** `schema/acl/*.sql` son espejos de ACL/RLS (REVOKE/GRANT/POLICY), no cuerpos de función. */
const DIRS_EXENTOS = ["supabase/schema/squash/", "supabase/schema/acl/"];

function listarSql(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) listarSql(full, acc);
    else if (entry.endsWith(".sql")) acc.push(full);
  }
  return acc;
}

const archivos = listarSql(SCHEMA_DIR).filter(
  (f) => {
    const rel = path.relative(ROOT, f).split(path.sep).join("/");
    return !EXENTOS.has(rel) && !DIRS_EXENTOS.some((d) => rel.startsWith(d));
  },
);
const violaciones: string[] = [];
for (const file of archivos) {
  const src = fs.readFileSync(file, "utf-8");
  if (!/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\./i.test(src)) {
    violaciones.push(path.relative(ROOT, file));
  }
}

if (violaciones.length > 0) {
  console.error("❌ Archivos de supabase/schema/ sin CREATE OR REPLACE FUNCTION public.:");
  for (const v of violaciones) console.error(`  - ${v}`);
  process.exit(1);
}
console.log(`✅ audit:schema-functions — ${archivos.length} archivos canónicos íntegros.`);
