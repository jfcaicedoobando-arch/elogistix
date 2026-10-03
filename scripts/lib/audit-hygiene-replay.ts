import { scanSecurityDefiner, stripSqlComments, type Violation } from "./audit-sql-signatures";

/** Equivalencia estricta: nombre, tabla, columnas, unicidad y predicado intactos. */
export function indexStatementKey(sql: string): string {
  return stripSqlComments(sql).replace(/\bif\s+not\s+exists\s+/gi, "")
    .replace(/\s+/g, " ").replace(/\s*([(),;])\s*/g, "$1").trim();
}

/** Reemisiones idempotentes; no allowlist ni aumento del baseline de higiene. */
export function indexReplayRepairs(bodies: ReadonlyMap<string, string>): Map<string, string> {
  const repaired = new Map<string, string>();
  for (const [file, body] of [...bodies].sort(([a], [b]) => a.localeCompare(b))) {
    const statements = stripSqlComments(body).matchAll(
      /create\s+(?:unique\s+)?index\s+if\s+not\s+exists\s+[a-z0-9_]+\b[^;]*;/gi);
    for (const statement of statements) repaired.set(indexStatementKey(statement[0]), file);
  }
  return repaired;
}

export function scanNonIdempotentIndexes(file: string, body: string,
  repairs: ReadonlyMap<string, string>): Violation[] {
  const statements = stripSqlComments(body).matchAll(
    /create\s+(?:unique\s+)?index\s+(?!if\s+not\s+exists)([a-z0-9_]+)\b[^;]*;/gi);
  const failures: Violation[] = [];
  for (const m of statements) {
    if ((repairs.get(indexStatementKey(m[0])) ?? "") > file) continue;
    failures.push({ file, check: "H4", detail: `CREATE INDEX ${m[1]} sin IF NOT EXISTS` });
  }
  return failures;
}

/** Reemisiones completas, no parches textuales. No interpreta SQL dinámico. */
function functionStatements(body: string): Array<{ name: string; sql: string }> {
  const clean = stripSqlComments(body);
  return [...clean.matchAll(
    /create\s+or\s+replace\s+function\s+public\.([a-z0-9_]+)\s*\([\s\S]*?\bas\s+(\$[a-z0-9_]*\$)[\s\S]*?\2\s*;/gi,
  )].map((m) => ({ name: m[1].toLowerCase(), sql: m[0] }));
}

function functionStatementKey(sql: string): string {
  // Respetar mayúsculas de literales SQL: un cambio de lógica NO es reparación de ACL.
  return stripSqlComments(sql).replace(/\s+/g, " ").trim();
}

export function functionReplayRepairs(bodies: ReadonlyMap<string, string>): Map<string, string> {
  const repairs = new Map<string, string>();
  for (const [file, body] of [...bodies].sort(([a], [b]) => a.localeCompare(b))) {
    const failures = scanSecurityDefiner(file, body.replace(/audit:allow-no-grants/gi, ""), true);
    for (const fn of functionStatements(body)) {
      if (!/security\s+definer/i.test(fn.sql)) continue;
      if (failures.some((v) => v.detail.startsWith(`public.${fn.name}(`))) continue;
      repairs.set(functionStatementKey(fn.sql), file);
    }
  }
  return repairs;
}

export function isFunctionReplayRepair(file: string, body: string, violation: Violation,
  repairs: ReadonlyMap<string, string>): boolean {
  // La prohibición de GRANT TO PUBLIC nunca es deuda reparable ni se omite.
  if (violation.check !== "H6" || !/ sin (REVOKE ALL|GRANT EXECUTE)/.test(violation.detail)) return false;
  return functionStatements(body).some((fn) => violation.detail.startsWith(`public.${fn.name}(`)
    && (repairs.get(functionStatementKey(fn.sql)) ?? "") > file);
}
