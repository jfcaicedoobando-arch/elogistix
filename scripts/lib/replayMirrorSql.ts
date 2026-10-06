/** Lexical normalization for the static replay guard, never executable SQL. */
export interface SqlToken {
  kind: "space" | "comment" | "word" | "quoted" | "dollar" | "symbol";
  text: string;
  start: number;
  end: number;
}

function quotedEnd(sql: string, start: number, quote: string, escapes: boolean): number {
  for (let i = start + 1; i < sql.length; i++) {
    if (escapes && sql[i] === "\\") { i++; continue; }
    if (sql[i] !== quote) continue;
    if (sql[i + 1] === quote) { i++; continue; }
    return i + 1;
  }
  throw new Error(`SQL: literal sin cierre en ${start}`);
}

function blockCommentEnd(sql: string, start: number): number {
  let depth = 1;
  for (let i = start + 2; i < sql.length; i++) {
    if (sql.startsWith("/*", i)) { depth++; i++; }
    else if (sql.startsWith("*/", i)) { depth--; i++; }
    if (depth === 0) return i + 1;
  }
  throw new Error(`SQL: comentario sin cierre en ${start}`);
}

function readToken(sql: string, start: number): SqlToken {
  const rest = sql.slice(start);
  const token = (kind: SqlToken["kind"], end: number): SqlToken =>
    ({ kind, text: sql.slice(start, end), start, end });
  const space = /^\s+/.exec(rest);
  if (space) return token("space", start + space[0].length);
  const comment = /^--[^\r\n]*/.exec(rest);
  if (comment) return token("comment", start + comment[0].length);
  if (rest.startsWith("/*")) return token("comment", blockCommentEnd(sql, start));
  // PostgreSQL standard_conforming_strings: backslash escapes only in E'…'.
  const escaped = /^[eE]'/.test(rest);
  if (escaped) return token("quoted", quotedEnd(sql, start + 1, "'", true));
  if (rest[0] === "'" || rest[0] === '"') {
    return token("quoted", quotedEnd(sql, start, rest[0], false));
  }
  const tag = /^\$(?:[a-zA-Z_][a-zA-Z0-9_]*)?\$/.exec(rest);
  if (tag) {
    const end = sql.indexOf(tag[0], start + tag[0].length);
    if (end < 0) throw new Error(`SQL: dollar-quote sin cierre en ${start}`);
    return token("dollar", end + tag[0].length);
  }
  const word = /^[a-zA-Z_\u0080-\uffff][a-zA-Z0-9_$\u0080-\uffff]*/.exec(rest);
  if (word) return token("word", start + word[0].length);
  return token("symbol", start + 1);
}

export function sqlTokens(sql: string): SqlToken[] {
  const tokens: SqlToken[] = [];
  for (let i = 0; i < sql.length;) {
    const token = readToken(sql, i);
    tokens.push(token);
    i = token.end;
  }
  return tokens;
}

export function significantTokens(sql: string): SqlToken[] {
  return sqlTokens(sql).filter((t) => t.kind !== "space" && t.kind !== "comment");
}

/** Preserve every literal byte, including nested dollar strings and identifiers. */
export function normalizeSql(sql: string): string {
  const tokens = sqlTokens(sql);
  let normalized = "";
  let separator = "";
  let previous: SqlToken | undefined;
  for (const token of tokens) {
    if (token.kind === "space" || token.kind === "comment") {
      separator += token.kind === "comment" ? token.text.replace(/[^\r\n]/g, " ") : token.text;
      continue;
    }
    // A newline between adjacent quoted strings means concatenation in SQL.
    // Do not equate it with a single space (which has different grammar).
    const adjacentStrings = previous?.kind === "quoted" && token.kind === "quoted";
    if (separator && normalized) normalized += adjacentStrings && /[\r\n]/.test(separator) ? "\n" : " ";
    normalized += token.text;
    separator = "";
    previous = token;
  }
  return normalized;
}
