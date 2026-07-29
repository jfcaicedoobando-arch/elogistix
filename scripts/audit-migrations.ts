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
import {
  scanSecurityDefiner,
  scanBackfillTenantGuard,
  type Violation,
} from "./lib/audit-sql-signatures";


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

export type { Violation };

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

  // H8 (FIX-F964) — backfills que usan funciones con guard multi-tenant.
  out.push(...scanBackfillTenantGuard(file, body));

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
