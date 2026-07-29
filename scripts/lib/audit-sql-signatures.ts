/**
 * Utilidades de análisis de firmas SQL para `scripts/audit-migrations.ts`.
 *
 * Extraído del auditor principal (v13.336.2) para mantener ambos archivos por
 * debajo del límite de `max-lines` del linter. No cambia el comportamiento.
 */

export type Violation = { file: string; check: string; detail: string };

/**
 * Divide una lista de argumentos por comas de primer nivel (ignora las que
 * están dentro de paréntesis, p. ej. `numeric(12,2)`).
 */
export function splitTopLevelCommas(src: string): string[] {
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

/**
 * Normaliza una lista de argumentos SQL a su forma tipada canónica.
 * Ej: `_user_id uuid, _role text DEFAULT 'x'` → `uuid, text`.
 * Se usa para comparar firmas entre `CREATE FUNCTION`, `REVOKE` y `GRANT`.
 */
export function normalizeArgTypes(rawArgs: string): string {
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
export const TYPE_ALIAS_GROUPS: string[][] = [
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
export function typeVariants(type: string): string[] {
  const t = type.trim().toLowerCase();
  const base = t.replace(/\[\]$/, "");
  const isArray = t.endsWith("[]");
  const group = TYPE_ALIAS_GROUPS.find((g) => g.includes(base));
  const variants = group ?? [base];
  return isArray ? variants.map((v) => `${v}[]`) : variants;
}

/** Quita comentarios `-- ...` (fin de línea) y `/* ... *\/` (bloque, no anidado). */
export function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

/** `src[openIdx]` debe ser '('. Devuelve el contenido entre parens balanceados. */
export function extractParenArgs(
  src: string,
  openIdx: number,
): { args: string; endIdx: number } | null {
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

export function findSecurityDefinerFunctions(body: string): Array<{
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

/** Construye el fragmento de regex que empata la firma aceptando alias de tipos. */
function buildSignatureRe(argTypes: string): string {
  if (argTypes.trim() === "") return "";
  return argTypes
    .split(",")
    .map((t) => {
      const alts = typeVariants(t).map((v) =>
        v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s*"),
      );
      return `(?:${alts.join("|")})`;
    })
    .join("\\s*,\\s*");
}

export function scanSecurityDefiner(
  file: string,
  body: string,
  auditPostBaseline: boolean,
): Violation[] {
  const out: Violation[] = [];
  for (const { name: fnName, argTypes, allowNoGrants } of findSecurityDefinerFunctions(body)) {
    const sigForRe = buildSignatureRe(argTypes);

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
