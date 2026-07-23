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
 * timestamp. Se eligió `20260723180000` (2026-07-23) como snapshot post-
 * auditoría arquitectura 3. Bump manual cuando aparezca legacy imposible
 * de corregir (nunca a la baja).
 */
const BASELINE = "20260723180000";

const FNAME_RE = /^(\d{14})_[a-z0-9-]+\.sql$/;

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

  return out;
}

/**
 * Normaliza una lista de argumentos SQL a su forma tipada canónica.
 * Ej: `_user_id uuid, _role text DEFAULT 'x'` → `uuid, text`.
 * Se usa para comparar firmas entre `CREATE FUNCTION`, `REVOKE` y `GRANT`.
 */
function normalizeArgTypes(rawArgs: string): string {
  const args = rawArgs.trim();
  if (args === "") return "";
  return args
    .split(",")
    .map((a) => {
      // Quitar DEFAULT y trim
      const noDefault = a.split(/\bdefault\b/i)[0].trim();
      // Quitar prefijo IN/OUT/INOUT/VARIADIC
      const noMode = noDefault.replace(/^(in|out|inout|variadic)\s+/i, "");
      // Tomar la última "palabra tipo" — puede incluir espacios (p.ej. "timestamp with time zone").
      // Heurística: si el primer token empieza con `_` (nombre de arg convencional), quitarlo.
      const tokens = noMode.split(/\s+/);
      if (tokens.length > 1 && /^_?[a-z][a-z0-9_]*$/i.test(tokens[0])) {
        return tokens.slice(1).join(" ").toLowerCase();
      }
      return noMode.toLowerCase();
    })
    .filter(Boolean)
    .join(", ");
}

function scanSecurityDefiner(file: string, body: string, auditPostBaseline: boolean): Violation[] {
  const out: Violation[] = [];
  // Detectar bloques CREATE OR REPLACE FUNCTION public.<name>(<args>) ... SECURITY DEFINER
  // El cuerpo puede tener SECURITY DEFINER en cualquier orden antes del AS $$.
  const fnRe =
    /(^|\n)([ \t]*--[^\n]*\n)?[ \t]*create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)\s*\(([^)]*)\)([\s\S]*?)(?:as\s+\$[a-z0-9_]*\$|language\s+sql\s*;)/gi;
  for (const m of body.matchAll(fnRe)) {
    const commentLine = m[2] ?? "";
    const fnName = m[3].toLowerCase();
    const argsRaw = m[4];
    const header = m[5];
    if (!/security\s+definer/i.test(header)) continue;

    // Excepción: comentario -- audit:allow-no-grants justo antes.
    const allowNoGrants = /audit:allow-no-grants/i.test(commentLine);

    // Normalizar firma para matchear REVOKE/GRANT
    const argTypes = normalizeArgTypes(argsRaw);
    // Regex tolerante: acepta espacios y firma exacta.
    const sigForRe = argTypes.replace(/\s+/g, "\\s*").replace(/,/g, "\\s*,\\s*");
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

    // Regla dura: TO PUBLIC prohibido, siempre.
    if (grantPublicRe.test(body)) {
      out.push({
        file,
        check: "H6",
        detail: `public.${fnName}(${argTypes}) SECURITY DEFINER con GRANT EXECUTE ... TO PUBLIC (prohibido)`,
      });
    }

    // El resto sólo se exige post-baseline (legacy queda documentado por otros tests).
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

main();
