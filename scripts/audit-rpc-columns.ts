/**
 * audit:rpc-columns — Barrido automatizado que detecta referencias a columnas
 * inexistentes dentro de funciones (RPCs) y vistas del esquema `public`.
 *
 * Motivación:
 *   v13.319.2 — `crear_embarque_borrador_core` referenciaba `v_cot.puerto_origen`
 *     cuando `cotizaciones` sólo tiene `origen`.
 *   v13.319.3 — la misma RPC leía `p.nombre` / `p.unlocode` cuando `puertos`
 *     expone `name` / `code`.
 *
 * Cómo funciona:
 *   1. Descarga la definición de todas las funciones y vistas de `public`.
 *   2. Detecta declaraciones de alias en cláusulas FROM / JOIN
 *      (`FROM public.tabla t`, `JOIN otra AS o`, `cotizaciones v_cot`, etc.).
 *   3. Busca referencias `<alias>.<columna>` y las valida contra las columnas
 *      reales de la tabla en `information_schema.columns`.
 *   4. Reporta cada `alias.columna` que apunta a una columna inexistente.
 *
 * Uso:
 *   bun run audit:rpc-columns
 *   (requiere PG* env vars — las mismas que usa psql en Lovable Cloud).
 *
 * Exit codes: 0 = limpio, 1 = hallazgos, 2 = error de ejecución.
 */
import { execFileSync } from "node:child_process";

// ---------- Helpers psql ----------
// Devuelve filas como arrays de strings. La consulta DEBE producir texto ya
// codificado (usar to_jsonb o replace de tabs/newlines antes de retornar).
function psqlJson<T = unknown>(sql: string): T[] {
  // Envuelve la consulta para que devuelva un array JSON de una sola fila.
  const wrapped = `SELECT coalesce(jsonb_agg(t), '[]'::jsonb)::text FROM (${sql}) t`;
  const raw = execFileSync(
    "psql",
    ["-X", "-A", "-t", "-q", "-c", wrapped],
    { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 },
  );
  return JSON.parse(raw.trim()) as T[];
}

// ---------- 1. Cargar columnas reales por tabla ----------
type ColMap = Map<string, Set<string>>;

function loadColumns(): ColMap {
  const rows = psqlJson<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'`,
  );
  const map: ColMap = new Map();
  for (const r of rows) {
    if (!map.has(r.table_name)) map.set(r.table_name, new Set());
    map.get(r.table_name)!.add(r.column_name);
  }
  return map;
}

// ---------- 2. Cargar definiciones de RPCs y vistas ----------
interface SqlObject { kind: "function" | "view"; name: string; body: string; }

function loadFunctions(): SqlObject[] {
  const rows = psqlJson<{ name: string; body: string }>(`
    SELECT p.proname AS name, pg_get_functiondef(p.oid) AS body
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
  `);
  return rows.map((r) => ({ kind: "function" as const, name: r.name, body: r.body ?? "" }));
}

function loadViews(): SqlObject[] {
  const rows = psqlJson<{ name: string; body: string }>(`
    SELECT table_name AS name, view_definition AS body
      FROM information_schema.views
     WHERE table_schema = 'public'
  `);
  return rows.map((r) => ({ kind: "view" as const, name: r.name, body: r.body ?? "" }));
}

// ---------- 3. Extraer alias → tabla ----------
// Reconoce patrones:
//   FROM public.cotizaciones v_cot
//   FROM cotizaciones AS c
//   JOIN puertos p ON ...
//   , clientes cl
// Ignora subqueries, CTEs y expresiones raras (mejor perder cobertura que dar falsos positivos).
const RESERVED = new Set([
  "select","from","where","and","or","on","as","join","left","right","inner",
  "outer","full","cross","lateral","using","group","order","by","having","limit",
  "offset","when","then","else","end","case","not","null","is","in","exists",
  "with","returning","values","set","into","distinct","union","all","intersect",
  "except","true","false","asc","desc","for","update","of","share","key","primary",
  "foreign","references","check","default","constraint","if","loop","return","query",
  "declare","begin","perform","raise","exception","language","stable","volatile",
  "immutable","strict","security","definer","invoker","rows","column","table","view",
  "function","procedure","trigger","before","after","each","row","statement","execute",
  "record","alias","current_setting","coalesce","nullif","concat",
]);

function extractAliases(body: string, tables: ColMap): Map<string, string> {
  const aliases = new Map<string, string>();
  // Normaliza: quita comentarios /* ... */ y -- ...
  const clean = body
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");

  // FROM|JOIN [public.]tabla [AS] alias
  const re = /\b(?:FROM|JOIN|,)\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+(?:AS\s+)?([a-z_][a-z0-9_]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    const table = m[1].toLowerCase();
    const alias = m[2].toLowerCase();
    if (!tables.has(table)) continue;             // no es tabla real
    if (RESERVED.has(alias)) continue;            // ej. "cotizaciones WHERE" → alias=where
    if (alias === table) continue;                // alias implícito = nombre tabla
    aliases.set(alias, table);
  }
  // También el nombre de la tabla puede usarse como su propio alias.
  const re2 = /\b(?:FROM|JOIN|,)\s+(?:public\.)?([a-z_][a-z0-9_]*)\b/gi;
  while ((m = re2.exec(clean)) !== null) {
    const table = m[1].toLowerCase();
    if (tables.has(table) && !aliases.has(table)) aliases.set(table, table);
  }
  return aliases;
}

// ---------- 4. Buscar alias.columna ilegales ----------
interface Finding { kind: string; name: string; alias: string; table: string; column: string; }

// Columnas de sistema / pseudos que siempre existen.
const SYSTEM_COLS = new Set(["*", "ctid", "xmin", "xmax", "cmin", "cmax", "tableoid", "oid"]);

function auditObject(obj: SqlObject, tables: ColMap): Finding[] {
  const aliases = extractAliases(obj.body, tables);
  if (aliases.size === 0) return [];
  const found: Finding[] = [];
  const seen = new Set<string>();
  const clean = obj.body.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
  const refRe = /\b([a-z_][a-z0-9_]*)\.([a-z_][a-z0-9_]*)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = refRe.exec(clean)) !== null) {
    const alias = m[1].toLowerCase();
    const column = m[2].toLowerCase();
    if (SYSTEM_COLS.has(column)) continue;
    const table = aliases.get(alias);
    if (!table) continue;                          // alias no rastreado (CTE, subquery, RECORD…)
    const cols = tables.get(table);
    if (!cols || cols.has(column)) continue;
    const key = `${obj.kind}:${obj.name}:${alias}.${column}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ kind: obj.kind, name: obj.name, alias, table, column });
  }
  return found;
}

// ---------- 5. Main ----------
async function main() {
  if (!process.env.PGHOST) {
    console.error("audit:rpc-columns — PGHOST no está definido; requiere acceso psql.");
    process.exit(2);
  }
  const tables = loadColumns();
  const objects = [...loadFunctions(), ...loadViews()];
  const findings: Finding[] = [];
  for (const obj of objects) findings.push(...auditObject(obj, tables));

  if (findings.length === 0) {
    console.log(`✓ audit:rpc-columns — ${objects.length} objetos escaneados, sin referencias inválidas.`);
    return;
  }
  console.error(`✗ audit:rpc-columns — ${findings.length} referencia(s) a columnas inexistentes:`);
  for (const f of findings) {
    console.error(
      `  [${f.kind}] ${f.name}: ${f.alias}.${f.column}  → tabla ${f.table} no tiene columna "${f.column}"`,
    );
  }
  process.exit(1);
}

main().catch((e) => {
  console.error("audit:rpc-columns falló:", e);
  process.exit(2);
});
