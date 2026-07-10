/**
 * CLI: audita funciones plpgsql en `supabase/migrations/**` buscando el
 * patrón "borra lo que no está en la lista" (bug ELIMP00245).
 *
 * Genera `reports/rpc-sync-audit.md`. Sólo lectura.
 * Uso: `bun run audit:rpc-sync`.
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, relative } from "node:path";
import { auditSql, type RpcFinding } from "./lib/rpcSync";

interface LiveResult {
  suspiciousFns: string[];
  orphans: Array<{ table: string; count: number }>;
  error?: string;
}

function runPsql(sql: string): string | null {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  try {
    return execSync(`psql -t -A -F"|" -c ${JSON.stringify(oneLine)}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (e) {
    console.error("[audit:rpc-sync] psql falló:", (e as Error).message.split("\n")[0]);
    return null;
  }
}

function inspectLive(): LiveResult {
  if (!process.env.PGHOST) return { suspiciousFns: [], orphans: [], error: "PGHOST no configurado" };
  const fnsRaw = runPsql(
    `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public'
       AND p.prosrc ~* 'array_agg' AND p.prosrc ~* 'RETURNING\\s+id\\s+INTO'
       AND (p.prosrc ~* 'deleted_at\\s*=\\s*now' OR p.prosrc ~* 'DELETE\\s+FROM')
       AND p.prosrc !~* 'array_append'
     ORDER BY 1`,
  );
  if (fnsRaw === null) return { suspiciousFns: [], orphans: [], error: "psql no disponible" };
  const suspiciousFns = fnsRaw ? fnsRaw.split("\n").filter(Boolean) : [];

  // Tablas con soft-delete a auditar.
  const softDeleteTables = ["conceptos_venta", "conceptos_costo", "embarque_contenedores", "documentos_embarque", "conceptos_factura"];
  const orphans: LiveResult["orphans"] = [];
  for (const t of softDeleteTables) {
    const raw = runPsql(
      `SELECT count(*) FROM public.${t} WHERE deleted_at IS NOT NULL AND deleted_at - created_at < interval '1 second'`,
    );
    if (raw === null) continue;
    orphans.push({ table: t, count: Number(raw) || 0 });
  }
  return { suspiciousFns, orphans };
}


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

function render(findings: RpcFinding[], live: LiveResult): string {
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
  lines.push(`- **Live catalog** (funciones vivas con patrón sin \`array_append\`): ${live.suspiciousFns.length}`);
  const orphanTotal = live.orphans.reduce((a, o) => a + o.count, 0);
  lines.push(`- **Filas huérfanas detectadas** (\`created_at ≈ deleted_at\`): ${orphanTotal}`);
  lines.push("");
  lines.push("## Migraciones — CRITICAL");
  lines.push("");
  if (critical.length === 0) lines.push("_Ninguna._");
  else {
    lines.push("| Función | Migración | Motivo |");
    lines.push("|---|---|---|");
    for (const f of critical)
      lines.push(`| \`${f.functionName}\` | \`${relative(ROOT, f.file)}\` | ${f.reason} |`);
  }
  lines.push("");
  lines.push("## Migraciones — HIGH");
  lines.push("");
  if (high.length === 0) lines.push("_Ninguna._");
  else {
    lines.push("| Función | Migración | Motivo |");
    lines.push("|---|---|---|");
    for (const f of high)
      lines.push(`| \`${f.functionName}\` | \`${relative(ROOT, f.file)}\` | ${f.reason} |`);
  }
  lines.push("");
  lines.push("## Catálogo vivo (pg_proc)");
  lines.push("");
  if (live.error) lines.push(`_${live.error} — sección omitida._`);
  else if (live.suspiciousFns.length === 0) lines.push("_Sin funciones vivas con el patrón._");
  else {
    lines.push("Funciones que combinan `array_agg` + `RETURNING id INTO` + borrado, y NO usan `array_append`:");
    lines.push("");
    for (const fn of live.suspiciousFns) lines.push(`- \`${fn}\``);
  }
  lines.push("");
  lines.push("## Filas huérfanas");
  lines.push("");
  if (live.orphans.length === 0) lines.push("_No inspeccionado._");
  else {
    lines.push("| Tabla | Filas con `created_at ≈ deleted_at` |");
    lines.push("|---|---:|");
    for (const o of live.orphans) lines.push(`| \`${o.table}\` | ${o.count} |`);
    lines.push("");
    lines.push(
      "> Un conteo > 0 no garantiza el bug (podría ser un borrado inmediato legítimo), pero es la huella exacta del patrón. Revisar caso por caso antes de rescatar.",
    );
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
  lines.push("Referencia: fix aplicado a `actualizar_embarque_completo` (versión 13.252.2).");
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
  const live = inspectLive();
  mkdirSync(join(ROOT, "reports"), { recursive: true });
  writeFileSync(OUT, render(latest, live), "utf8");
  const c = latest.filter((f) => f.severity === "CRITICAL").length;
  const h = latest.filter((f) => f.severity === "HIGH").length;
  console.log(
    `✔ ${files.length} migraciones · ${latest.length} sospechosas (${c} CRITICAL, ${h} HIGH) · ${live.suspiciousFns.length} en catálogo vivo`,
  );
  console.log(`  → ${relative(ROOT, OUT)}`);
}

main();

