/**
 * CLI: audita funciones plpgsql en `supabase/migrations/**` buscando el
 * patrón "borra lo que no está en la lista" (bug ELIMP00245).
 *
 * Genera `reports/rpc-sync-audit.md`. Sólo lectura.
 * Uso: `bun run audit:rpc-sync`.
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { auditSql, type RpcFinding } from "./lib/rpcSync";

const ROOT = process.cwd();
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const OUT = join(ROOT, "reports", "rpc-sync-audit.md");

function collectSqlFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => join(dir, f));
}

/**
 * Sólo nos quedamos con la definición más reciente de cada función
 * (última migración en orden lexicográfico = timestamp).
 */
function dedupeLatest(findings: RpcFinding[]): RpcFinding[] {
  const byFn = new Map<string, RpcFinding>();
  const sorted = [...findings].sort((a, b) => a.file.localeCompare(b.file));
  for (const f of sorted) byFn.set(f.functionName, f);
  return [...byFn.values()];
}

function render(findings: RpcFinding[]): string {
  const critical = findings.filter((f) => f.severity === "CRITICAL");
  const high = findings.filter((f) => f.severity === "HIGH");
  const date = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`# RPC Sync Audit — ${date}`);
  lines.push("");
  lines.push(
    "Detecta funciones plpgsql que reciben una lista de hijos, insertan nuevos y al final",
    "borran (soft o duro) todo lo que no está en la lista original — sin agregar los ids",
    "recién generados. Es el patrón del bug ELIMP00245.",
    "",
  );
  lines.push(`- **CRITICAL** (3 señales): ${critical.length}`);
  lines.push(`- **HIGH** (2 señales, revisión manual): ${high.length}`);
  lines.push("");
  lines.push("## CRITICAL");
  lines.push("");
  if (critical.length === 0) lines.push("_Ninguna._");
  else {
    lines.push("| Función | Migración | Motivo |");
    lines.push("|---|---|---|");
    for (const f of critical) {
      lines.push(`| \`${f.functionName}\` | \`${relative(ROOT, f.file)}\` | ${f.reason} |`);
    }
  }
  lines.push("");
  lines.push("## HIGH");
  lines.push("");
  if (high.length === 0) lines.push("_Ninguna._");
  else {
    lines.push("| Función | Migración | Motivo |");
    lines.push("|---|---|---|");
    for (const f of high) {
      lines.push(`| \`${f.functionName}\` | \`${relative(ROOT, f.file)}\` | ${f.reason} |`);
    }
  }
  lines.push("");
  lines.push("## Cómo se corrige el patrón");
  lines.push("");
  lines.push("Tras cada `INSERT ... RETURNING id INTO v_new_id`, agregar:");
  lines.push("");
  lines.push("```sql");
  lines.push("v_incoming_ids := array_append(v_incoming_ids, v_new_id);");
  lines.push("```");
  lines.push("");
  lines.push(
    "Referencia: fix aplicado a `actualizar_embarque_completo` (versión 13.252.2).",
  );
  return lines.join("\n") + "\n";
}

function main() {
  const files = collectSqlFiles(MIGRATIONS_DIR);
  const all: RpcFinding[] = [];
  for (const f of files) {
    const sql = readFileSync(f, "utf8");
    all.push(...auditSql(f, sql));
  }
  const latest = dedupeLatest(all);
  mkdirSync(join(ROOT, "reports"), { recursive: true });
  writeFileSync(OUT, render(latest), "utf8");
  const c = latest.filter((f) => f.severity === "CRITICAL").length;
  const h = latest.filter((f) => f.severity === "HIGH").length;
  console.log(`✔ ${files.length} migraciones, ${latest.length} funciones sospechosas (${c} CRITICAL, ${h} HIGH)`);
  console.log(`  → ${relative(ROOT, OUT)}`);
}

main();
