/**
 * Auditoría de higiene de migraciones SQL.
 * Uso: `bun run audit:migrations`
 *
 * Regla base: sólo se aplican los checks a migraciones **nuevas** (timestamp
 * >= BASELINE). El historial legacy tiene violaciones documentadas que no
 * podemos reescribir sin refactor de esquema; el auditor sirve para prevenir
 * regresiones hacia adelante.
 *
 * Checks:
 *  H1  Nombre de archivo: `YYYYMMDDHHMMSS_snake_case.sql` (uuid tras `_` ok).
 *  H2  `CREATE TABLE ... public.<t>` DEBE ir acompañado en el mismo archivo
 *      de al menos un `GRANT ... ON ... public.<t>` (contrato Data API).
 *  H3  `DROP FUNCTION|TABLE|VIEW ... CASCADE` DEBE ir seguido en el mismo
 *      archivo por `CREATE OR REPLACE FUNCTION|VIEW` o `CREATE TABLE` para
 *      la misma entidad (recreación explícita).
 *  H4  `CREATE INDEX` / `CREATE POLICY` DEBEN usar `IF NOT EXISTS`
 *      (idempotencia). NB: Postgres no soporta `CREATE POLICY IF NOT EXISTS`
 *      antes de PG16; se acepta también `DROP POLICY IF EXISTS ... ; CREATE POLICY`.
 *  H5  Prohibido `DROP TABLE public.*` sin `IF EXISTS`.
 *  H6  Toda `CREATE OR REPLACE FUNCTION public.<f>(...) ... SECURITY DEFINER`
 *      DEBE ir acompañada en el mismo archivo de:
 *        - `REVOKE ALL ON FUNCTION public.<f>(<args>) FROM PUBLIC` (o `FROM PUBLIC, anon`)
 *        - `GRANT EXECUTE ON FUNCTION public.<f>(<args>) TO <rol>` con rol ∈
 *          {authenticated, service_role, postgres}. Prohibido `TO PUBLIC`.
 *      Excepción: comentario `-- audit:allow-no-grants` justo antes del
 *      `CREATE OR REPLACE FUNCTION` (helpers privados sin exposición externa).
 *      La regla `GRANT EXECUTE ... TO PUBLIC` sobre SECURITY DEFINER es dura
 *      y aplica siempre (aun a legacy pre-baseline).
 *
 * Salida: exit 0 si limpio, 1 si hay violaciones (con listado agrupado).
 */
import fs from "node:fs";
import path from "node:path";

const MIG_DIR = path.resolve(process.cwd(), "supabase/migrations");
/**
 * Fecha de corte: sólo auditamos migraciones creadas a partir de este
 * timestamp. Las migraciones ya aplicadas no son editables, por lo que el
 * legacy se cierra en el baseline y se corrige en BD con una migración
 * posterior. Bump manual cuando aparezca legacy imposible de corregir;
 * nunca a la baja.
 *
 * Historial de bumps:
 *  - `20260723223436` — snapshot post-FIX-H6-01 (REVOKE/GRANT de
 *    `guard_pago_proveedor` y `_crear_embarque_replicar_conceptos`).
 *  - `20260725184834` — snapshot intermedio.
 *  - `20260729170000` — post-FIX-H6-02: `20260729164301` recreó
 *    `convertir_proformas_a_factura` (SECURITY DEFINER) sin el bloque
 *    REVOKE/GRANT en el mismo archivo. Los permisos en BD ya eran correctos
 *    (`proacl` sin PUBLIC) y quedan re-aplicados explícitamente por la
 *    migración FIX-H6-02 posterior.
 */
const BASELINE = "20260729170000";

export const FNAME_RE = /^(\d{14})_[a-z0-9_-]+\.sql$/;

type Violation = { file: string; check: string; detail: string };

export function scanFile(file: string, body: string, auditPostBaseline = true): Violation[] {
  const out: Violation[] = [];

  // H2 — CREATE TABLE public.X requiere GRANT ... public.X
  const createTableRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/gi;
  const tables = new Set<string>();
  for (const m of body.matchAll(createTableRe)) tables.add(m[1].toLowerCase());
  for (const t of tables) {
    const grantRe = new RegExp(`grant\\s+[^;]+on\\s+(?:table\\s+)?public\\.${t}\\b`, "i");
    if (!grantRe.test(body)) {
      out.push({ file, check: "H2", detail: `public.${t} sin GRANT en el mismo archivo` });
    }
  }

  // H3 — DROP ... CASCADE requiere recreación en el mismo archivo
  const dropCascadeRe =
    /drop\s+(function|table|view)\s+(?:if\s+exists\s+)?(?:public\.)?([a-z0-9_]+)[^;]*cascade/gi;
  for (const m of body.matchAll(dropCascadeRe)) {
    const kind = m[1].toLowerCase();
    const name = m[2].toLowerCase();
    const recreateRe =
      kind === "table"
        ? new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${name}\\b`, "i")
        : kind === "view"
          ? new RegExp(`create\\s+(?:or\\s+replace\\s+)?view\\s+public\\.${name}\\b`, "i")
          : new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${name}\\b`, "i");
    if (!recreateRe.test(body)) {
      out.push({
        file,
        check: "H3",
        detail: `DROP ${kind.toUpperCase()} public.${name} CASCADE sin recreación`,
      });
    }
  }

  // H4a — CREATE INDEX sin IF NOT EXISTS
  const idxRe = /create\s+(?:unique\s+)?index\s+(?!if\s+not\s+exists)([a-z0-9_]+)/gi;
  for (const m of body.matchAll(idxRe)) {
    out.push({ file, check: "H4", detail: `CREATE INDEX ${m[1]} sin IF NOT EXISTS` });
  }

  // H4b — CREATE POLICY sin DROP POLICY previa (idempotencia PG<16)
  const policyRe = /create\s+policy\s+"([^"]+)"\s+on\s+(public\.[a-z0-9_]+)/gi;
  for (const m of body.matchAll(policyRe)) {
    const [, polName, target] = m;
    const dropRe = new RegExp(
      `drop\\s+policy\\s+if\\s+exists\\s+"${polName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s+on\\s+${target.replace(/\./, "\\.")}`,
      "i",
    );
    if (!dropRe.test(body)) {
      out.push({
        file,
        check: "H4",
        detail: `CREATE POLICY "${polName}" on ${target} sin DROP POLICY IF EXISTS previa`,
      });
    }
  }

  // H5 — DROP TABLE sin IF EXISTS
  const dropTableRe = /drop\s+table\s+(?!if\s+exists)public\.([a-z0-9_]+)/gi;
  for (const m of body.matchAll(dropTableRe)) {
    out.push({ file, check: "H5", detail: `DROP TABLE public.${m[1]} sin IF EXISTS` });
  }

  // H6 — SECURITY DEFINER requiere REVOKE + GRANT EXECUTE apropiados
  out.push(...scanSecurityDefiner(file, body, auditPostBaseline));

  // H7 (P-10) — `ALTER TYPE ... RENAME VALUE` no reescribe los cuerpos de las
  // funciones: cualquier función creada antes con el literal viejo queda rota
  // en runtime (22P02). Exigimos recrear dependientes en la misma migración.
  const renameValueRe = /alter\s+type\s+[a-z0-9_."]+\s+rename\s+value/gi;
  if (renameValueRe.test(body) && !/create\s+(or\s+replace\s+)?function/i.test(body)) {
    out.push({
      file,
      check: "H7",
      detail:
        "ALTER TYPE ... RENAME VALUE sin recrear funciones dependientes en el mismo archivo",
    });
  }

  return out;
}


/**
 * Normaliza una lista de argumentos SQL a su forma tipada canónica.
 * Ej: `_user_id uuid, _role text DEFAULT 'x'` → `uuid, text`.
 * Se usa para comparar firmas entre `CREATE FUNCTION`, `REVOKE` y `GRANT`.
 */
function splitTopLevelCommas(src: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = "";
  for (const c of src) {
    if (c === "(") depth += 1;
    else if (c === ")") depth -= 1;
    if (c === "," && depth === 0) {
      out.push(buf);
      buf = "";
    } else {
      buf += c;
    }
  }
  if (buf.trim() !== "") out.push(buf);
  return out;
}

function normalizeArgTypes(rawArgs: string): string {
  const args = rawArgs.trim();
  if (args === "") return "";
  return splitTopLevelCommas(args)
    .map((a) => {
      const noDefault = a.split(/\bdefault\b/i)[0].trim();
      const noMode = noDefault.replace(/^(in|out|inout|variadic)\s+/i, "");
      const tokens = noMode.split(/\s+/);
      // Si el primer token es un nombre de argumento (identificador), quitarlo.
      const typeTokens =
        tokens.length > 1 && /^_?[a-z][a-z0-9_]*$/i.test(tokens[0]) ? tokens.slice(1) : tokens;
      // Quitar modificadores `(...)` de precisión/escala (no forman parte de la firma en pg_proc).
      return typeTokens.join(" ").toLowerCase().replace(/\s*\([^)]*\)/g, "");
    })
    .filter(Boolean)
    .join(", ");
}

/** Grupos de alias de tipos Postgres equivalentes en la firma de una función. */
const TYPE_ALIAS_GROUPS: string[][] = [
  ["timestamptz", "timestamp with time zone"],
  ["timestamp", "timestamp without time zone"],
  ["timetz", "time with time zone"],
  ["int", "int4", "integer"],
  ["int8", "bigint"],
  ["int2", "smallint"],
  ["bool", "boolean"],
  ["varchar", "character varying"],
  ["char", "character"],
  ["float8", "double precision"],
  ["float4", "real"],
  ["numeric", "decimal"],
];

/** Devuelve todas las formas equivalentes de un tipo (incluyéndolo). */
function typeVariants(type: string): string[] {
  const t = type.trim().toLowerCase();
  const base = t.replace(/\[\]$/, "");
  const isArray = t.endsWith("[]");
  const group = TYPE_ALIAS_GROUPS.find((g) => g.includes(base));
  const variants = group ?? [base];
  return isArray ? variants.map((v) => `${v}[]`) : variants;
}



function stripSqlComments(sql: string): string {
  // Quita comentarios `-- ...` (fin de línea) y `/* ... */` (bloque, no anidado).
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

function extractParenArgs(src: string, openIdx: number): { args: string; endIdx: number } | null {
  // src[openIdx] debe ser '('. Devuelve el contenido entre parens balanceados.
  if (src[openIdx] !== "(") return null;
  let depth = 0;
  for (let i = openIdx; i < src.length; i += 1) {
    const c = src[i];
    if (c === "(") depth += 1;
    else if (c === ")") {
      depth -= 1;
      if (depth === 0) return { args: src.slice(openIdx + 1, i), endIdx: i };
    }
  }
  return null;
}

function findSecurityDefinerFunctions(body: string): Array<{
  name: string;
  argTypes: string;
  allowNoGrants: boolean;
}> {
  const clean = stripSqlComments(body);
  const headerRe = /create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)\s*\(/gi;
  const found: Array<{ name: string; argTypes: string; allowNoGrants: boolean }> = [];
  for (const m of clean.matchAll(headerRe)) {
    const name = m[1].toLowerCase();
    const openIdx = (m.index ?? 0) + m[0].length - 1;
    const parsed = extractParenArgs(clean, openIdx);
    if (!parsed) continue;
    // Tomamos ~800 chars después de la firma para buscar SECURITY DEFINER (basta para header).
    const post = clean.slice(parsed.endIdx, parsed.endIdx + 800);
    if (!/security\s+definer/i.test(post)) continue;
    // audit:allow-no-grants: buscar en las 2 líneas previas al header (usar body original).
    const rawIdx = body.indexOf(m[0]);
    const prev = rawIdx > 0 ? body.slice(Math.max(0, rawIdx - 200), rawIdx) : "";
    const allowNoGrants = /audit:allow-no-grants/i.test(prev);
    found.push({ name, argTypes: normalizeArgTypes(parsed.args), allowNoGrants });
  }
  return found;
}

function scanSecurityDefiner(file: string, body: string, auditPostBaseline: boolean): Violation[] {
  const out: Violation[] = [];
  const fns = findSecurityDefinerFunctions(body);
  for (const { name: fnName, argTypes, allowNoGrants } of fns) {
    // La firma acepta alias equivalentes (p. ej. `timestamptz` ≡ `timestamp with time zone`).
    const sigForRe =
      argTypes.trim() === ""
        ? ""
        : argTypes
            .split(",")
            .map((t) => {
              const alts = typeVariants(t).map((v) =>
                v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"),
              );
              return `(?:${alts.join("|")})`;
            })
            .join("\\s*,\\s*");

    const revokeRe = new RegExp(
      `revoke\\s+(?:all|execute)[^;]*on\\s+function\\s+public\\.${fnName}\\s*\\(\\s*${sigForRe}\\s*\\)[^;]*from\\s+[^;]*\\bpublic\\b`,
      "i",
    );
    const grantOkRe = new RegExp(
      `grant\\s+execute\\s+on\\s+function\\s+public\\.${fnName}\\s*\\(\\s*${sigForRe}\\s*\\)[^;]*to\\s+[^;]*\\b(authenticated|service_role|postgres)\\b`,
      "i",
    );
    const grantPublicRe = new RegExp(
      `grant\\s+execute\\s+on\\s+function\\s+public\\.${fnName}\\s*\\(\\s*${sigForRe}\\s*\\)[^;]*to\\s+[^;]*\\bpublic\\b`,
      "i",
    );

    if (grantPublicRe.test(body)) {
      out.push({
        file,
        check: "H6",
        detail: `public.${fnName}(${argTypes}) SECURITY DEFINER con GRANT EXECUTE ... TO PUBLIC (prohibido)`,
      });
    }

    if (!auditPostBaseline || allowNoGrants) continue;

    if (!revokeRe.test(body)) {
      out.push({
        file,
        check: "H6",
        detail: `public.${fnName}(${argTypes}) SECURITY DEFINER sin REVOKE ALL ... FROM PUBLIC`,
      });
    }
    if (!grantOkRe.test(body)) {
      out.push({
        file,
        check: "H6",
        detail: `public.${fnName}(${argTypes}) SECURITY DEFINER sin GRANT EXECUTE ... TO {authenticated|service_role|postgres}`,
      });
    }
  }
  return out;
}

function main() {
  const all = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith(".sql")).sort();
  const violations: Violation[] = [];
  const badNames: string[] = [];

  for (const f of all) {
    const match = FNAME_RE.exec(f);
    const rawTs = /^(\d{14})/.exec(f)?.[1];
    const isPostBaseline = !rawTs || rawTs >= BASELINE;
    if (!isPostBaseline) {
      // Legacy: sólo evaluamos H6 regla dura (GRANT EXECUTE ... TO PUBLIC).
      const body = fs.readFileSync(path.join(MIG_DIR, f), "utf8");
      const legacy = scanFile(f, body, false).filter((v) => v.check === "H6");
      violations.push(...legacy);
      continue;
    }
    if (!match) {
      badNames.push(f);
      continue;
    }
    const body = fs.readFileSync(path.join(MIG_DIR, f), "utf8");
    violations.push(...scanFile(f, body, true));
  }

  const total = badNames.length + violations.length;
  console.log(`\n${"=".repeat(64)}\nAudit migraciones (baseline ${BASELINE})\n${"=".repeat(64)}`);
  console.log(`Archivos revisados: ${all.filter((f) => (FNAME_RE.exec(f)?.[1] ?? "0") >= BASELINE).length} / ${all.length} totales`);

  if (badNames.length > 0) {
    console.log(`\n❌ H1 — nombre inválido (${badNames.length}):`);
    badNames.forEach((f) => console.log(`  • ${f}`));
  }

  if (violations.length > 0) {
    const byCheck = new Map<string, Violation[]>();
    for (const v of violations) {
      const arr = byCheck.get(v.check) ?? [];
      arr.push(v);
      byCheck.set(v.check, arr);
    }
    for (const [check, arr] of [...byCheck.entries()].sort()) {
      console.log(`\n❌ ${check} — ${arr.length} violación(es):`);
      arr.forEach((v) => console.log(`  • ${v.file}: ${v.detail}`));
    }
  }

  if (total === 0) {
    console.log("\n✅ Migraciones limpias (post-baseline).\n");
    process.exit(0);
  }
  console.log(`\nTotal: ${total} violación(es). Corregir antes de mergear.\n`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
