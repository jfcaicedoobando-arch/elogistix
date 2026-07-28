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
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

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

// Un alias "opaco" es uno rebindeado dentro del cuerpo a un CTE o subquery.
// No podemos validar sus columnas estáticamente, así que se salta.
const OPAQUE = "__opaque__";

function extractAliases(body: string, tables: ColMap): Map<string, Set<string>> {
  // Un mismo alias puede reutilizarse dentro de la misma función para tablas
  // distintas o para un CTE. Guardamos TODAS las tablas candidatas; si el
  // alias también aparece bindeado a un no-table (CTE), lo marcamos opaco.
  const aliases = new Map<string, Set<string>>();
  const clean = body
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");

  const add = (alias: string, table: string) => {
    if (!aliases.has(alias)) aliases.set(alias, new Set());
    aliases.get(alias)!.add(table);
  };

  // FROM|JOIN [public.]tabla [AS] alias
  const re = /\b(?:FROM|JOIN|,)\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+(?:AS\s+)?([a-z_][a-z0-9_]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) {
    const source = m[1].toLowerCase();
    const alias = m[2].toLowerCase();
    if (RESERVED.has(alias)) continue;
    if (tables.has(source)) {
      add(alias, source);
    } else {
      // Es un CTE o derivada — degrada el alias a opaco.
      add(alias, OPAQUE);
    }
  }
  // v13.322.1 — Alias de subquery/derivada/LATERAL: `... ) p ON true`,
  // `... ) AS x`. Sus columnas se calculan en la subquery, así que NO son
  // validables contra el catálogo: se marcan opacas para evitar falsos
  // positivos (antes `LEFT JOIN LATERAL (...) p` colisionaba con la tabla
  // `proformas` aliaseada como `p` en otra parte del cuerpo).
  const reDerived = /\)\s*(?:AS\s+)?([a-z_][a-z0-9_]*)/gi;
  while ((m = reDerived.exec(clean)) !== null) {
    const alias = m[1].toLowerCase();
    if (RESERVED.has(alias)) continue;
    add(alias, OPAQUE);
  }
  // Tabla usada sin alias: su propio nombre es alias válido.
  const re2 = /\b(?:FROM|JOIN|,)\s+(?:public\.)?([a-z_][a-z0-9_]*)\b/gi;
  while ((m = re2.exec(clean)) !== null) {
    const table = m[1].toLowerCase();
    if (tables.has(table)) add(table, table);
  }
  return aliases;
}

// ---------- 4. Buscar alias.columna ilegales ----------
interface Finding { kind: string; name: string; alias: string; tables: string[]; column: string; }

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
    const candidates = aliases.get(alias);
    if (!candidates) continue;
    if (candidates.has(OPAQUE)) continue;         // alias rebindeado a CTE/subquery → no validable
    // Válido si la columna existe en al menos UNA de las tablas candidatas.
    let existsSomewhere = false;
    for (const t of candidates) {
      if (tables.get(t)?.has(column)) { existsSomewhere = true; break; }
    }
    if (existsSomewhere) continue;
    const key = `${obj.kind}:${obj.name}:${alias}.${column}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ kind: obj.kind, name: obj.name, alias, tables: [...candidates], column });
  }
  return found;
}

// ---------- 5. Allow-list ----------
// Formato de cada entrada: "<kind>:<name>:<alias>.<column>".
// Preexistentes conocidos se listan en scripts/audit-rpc-columns-allowlist.json
// para no romper CI mientras se planea el fix.
function loadAllowlist(): Set<string> {
  const p = path.join(process.cwd(), "scripts/audit-rpc-columns-allowlist.json");
  if (!existsSync(p)) return new Set();
  try {
    const parsed = JSON.parse(readFileSync(p, "utf8")) as { allow?: string[] };
    return new Set(parsed.allow ?? []);
  } catch (e) {
    console.error(`audit:rpc-columns — allowlist inválido en ${p}:`, e);
    return new Set();
  }
}

function findingKey(f: Finding): string {
  return `${f.kind}:${f.name}:${f.alias}.${f.column}`;
}

// ---------- 6. Main ----------
async function main() {
  if (!process.env.PGHOST) {
    console.error("audit:rpc-columns — PGHOST no está definido; requiere acceso psql.");
    process.exit(2);
  }
  const tables = loadColumns();
  const allowed = loadAllowlist();
  const objects = [...loadFunctions(), ...loadViews()];
  const raw: Finding[] = [];
  for (const obj of objects) raw.push(...auditObject(obj, tables));

  const knownPreexisting = raw.filter((f) => allowed.has(findingKey(f)));
  const newFindings = raw.filter((f) => !allowed.has(findingKey(f)));

  // Reporta entradas de allow-list que ya no producen hallazgo — hay que limpiarlas.
  const stillPresent = new Set(raw.map(findingKey));
  const stale = [...allowed].filter((k) => !stillPresent.has(k));

  console.log(
    `audit:rpc-columns — ${objects.length} objetos escaneados. ` +
      `${knownPreexisting.length} preexistente(s) en allow-list, ` +
      `${newFindings.length} nuevo(s), ${stale.length} entrada(s) obsoleta(s).`,
  );

  if (knownPreexisting.length > 0) {
    console.log("Preexistentes (permitidos temporalmente — arreglar y remover del allow-list):");
    for (const f of knownPreexisting) {
      console.log(`  · [${f.kind}] ${f.name}: ${f.alias}.${f.column}  (tablas: ${f.tables.join(", ")})`);
    }
  }

  if (stale.length > 0) {
    console.error("✗ Entradas del allow-list que ya no aplican (bórralas):");
    for (const k of stale) console.error(`  · ${k}`);
  }

  if (newFindings.length === 0 && stale.length === 0) {
    console.log("✓ Sin regresiones.");
    return;
  }

  if (newFindings.length > 0) {
    console.error(`✗ ${newFindings.length} referencia(s) NUEVAS a columnas inexistentes:`);
    for (const f of newFindings) {
      console.error(
        `  [${f.kind}] ${f.name}: ${f.alias}.${f.column}  → ninguna de {${f.tables.join(", ")}} tiene columna "${f.column}"`,
      );
    }
  }
  process.exit(1);
}

main().catch((e) => {
  console.error("audit:rpc-columns falló:", e);
  process.exit(2);
});
