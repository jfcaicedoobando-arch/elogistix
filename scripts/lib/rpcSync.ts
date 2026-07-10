/**
 * Lógica pura para detectar el patrón "borra lo que no está en la lista"
 * en funciones plpgsql:
 *
 *   1. Se declara/pobla un array de ids desde el payload ANTES del loop.
 *   2. Dentro del loop hay INSERT ... RETURNING id INTO v_new que NO se
 *      agrega al array.
 *   3. Al final hay un borrado (soft o duro) por complemento:
 *      WHERE NOT (id = ANY(<array>))  o  WHERE id NOT IN (...).
 *
 * Cumplir las 3 señales = CRITICAL. 2 señales = HIGH. <2 = ignorar.
 */

export type Severity = "CRITICAL" | "HIGH";

export interface RpcFinding {
  file: string;
  functionName: string;
  signals: {
    capturePriorIds: boolean;
    insertReturningId: boolean;
    appendAfterInsert: boolean;
    deleteByComplement: boolean;
  };
  severity: Severity;
  reason: string;
}

const FUNC_HEADER = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z_.]+)\s*\(/gi;

/** Extrae bloques `CREATE FUNCTION ... $$ ... $$` de un SQL. */
export function extractFunctions(sql: string): Array<{ name: string; body: string }> {
  const out: Array<{ name: string; body: string }> = [];
  const headers = [...sql.matchAll(FUNC_HEADER)];
  for (const h of headers) {
    const name = h[1].replace(/^public\./, "");
    const start = h.index ?? 0;
    // Encontrar $$ ... $$
    const dollar = sql.indexOf("$$", start);
    if (dollar === -1) continue;
    const end = sql.indexOf("$$", dollar + 2);
    if (end === -1) continue;
    out.push({ name, body: sql.slice(dollar + 2, end) });
  }
  return out;
}

export function analyzeBody(body: string): RpcFinding["signals"] {
  // Señal 1: array de ids capturado desde payload antes del loop.
  const capturePriorIds =
    /(?:array_agg|SELECT\s+array_agg)\s*\(/i.test(body) &&
    /\b(v_[a-z_]*(?:incoming|keep|existing|input|payload)[a-z_]*_ids?)\b/i.test(body);

  // Señal 2: INSERT ... RETURNING id INTO <var>.
  const insertRe = /INSERT\s+INTO[\s\S]{0,400}?RETURNING\s+id\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  const inserts = [...body.matchAll(insertRe)];
  const insertReturningId = inserts.length > 0;

  // Señal 2b: ¿hay array_append(<array>, <var>) después de cada insert?
  let appendAfterInsert = true;
  for (const m of inserts) {
    const varName = m[1];
    const after = body.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 400);
    const appended = new RegExp(`array_append\\s*\\([^)]*,\\s*${varName}\\b`, "i").test(after);
    if (!appended) {
      appendAfterInsert = false;
      break;
    }
  }
  if (!insertReturningId) appendAfterInsert = false;

  // Señal 3: borrado por complemento.
  const deleteByComplement =
    /NOT\s*\(\s*id\s*=\s*ANY\s*\(/i.test(body) ||
    /\bid\s+NOT\s+IN\s*\(/i.test(body) ||
    /deleted_at\s*=\s*now\(\)[\s\S]{0,200}NOT\s*\(/i.test(body);

  return { capturePriorIds, insertReturningId, appendAfterInsert, deleteByComplement };
}

export function scoreFinding(signals: RpcFinding["signals"]): Severity | null {
  const { capturePriorIds, insertReturningId, appendAfterInsert, deleteByComplement } = signals;
  // Patrón exacto: captura previa + insert-sin-append + delete complemento.
  const criticalHit =
    capturePriorIds && insertReturningId && !appendAfterInsert && deleteByComplement;
  if (criticalHit) return "CRITICAL";

  // Dos de tres señales de riesgo.
  const risky = [capturePriorIds, insertReturningId && !appendAfterInsert, deleteByComplement].filter(
    Boolean,
  ).length;
  if (risky >= 2) return "HIGH";
  return null;
}

export function auditSql(file: string, sql: string): RpcFinding[] {
  const findings: RpcFinding[] = [];
  for (const fn of extractFunctions(sql)) {
    const signals = analyzeBody(fn.body);
    const severity = scoreFinding(signals);
    if (!severity) continue;
    const reasons: string[] = [];
    if (signals.capturePriorIds) reasons.push("captura ids del payload antes del loop");
    if (signals.insertReturningId && !signals.appendAfterInsert)
      reasons.push("INSERT ... RETURNING id sin array_append posterior");
    if (signals.deleteByComplement) reasons.push("borrado por complemento (NOT IN / NOT ANY)");
    findings.push({
      file,
      functionName: fn.name,
      signals,
      severity,
      reason: reasons.join(" + "),
    });
  }
  return findings;
}
