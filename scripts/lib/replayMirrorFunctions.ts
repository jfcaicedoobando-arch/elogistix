import { TYPE_ALIAS_GROUPS } from "./audit-sql-signatures";
import { normalizeSql, significantTokens, type SqlToken } from "./replayMirrorSql";

export interface DefinicionFuncion {
  nombre: string;
  /** PostgreSQL identity: name and input argument types, excluding defaults. */
  firma: string;
  /** Full declaration and body, encoded separately to avoid delimiter collisions. */
  cuerpo: string;
}

function splitArgs(tokens: SqlToken[]): SqlToken[][] {
  const result: SqlToken[][] = [[]];
  let depth = 0;
  for (const token of tokens) {
    if (token.text === "(" || token.text === "[") depth++;
    if (token.text === ")" || token.text === "]") depth--;
    if (token.text === "," && depth === 0) result.push([]);
    else result.at(-1)!.push(token);
  }
  return result.filter((arg) => arg.length > 0);
}

function argumentType(tokens: SqlToken[]): string | null {
  let arg = tokens;
  if (/^out$/i.test(arg[0]?.text)) return null;
  if (/^(in|inout|variadic)$/i.test(arg[0]?.text)) arg = arg.slice(1);
  const end = arg.findIndex((token) => /^default$/i.test(token.text) || token.text === "=");
  if (end >= 0) arg = arg.slice(0, end);
  // Named arguments have two identifiers. Keep multiword built-in types.
  const multiword = /^(double precision|character varying|bit varying|(?:time|timestamp) (?:with|without))\b/i;
  const words = arg.map((t) => t.text).join(" ");
  if (arg.length > 1 && ["word", "quoted"].includes(arg[1].kind) && !multiword.test(words)) {
    arg = arg.slice(1);
  }
  const type = arg.map((t) => t.kind === "word" ? t.text.toLowerCase() : t.text)
    .join(" ").replace(/\s*([.[\]])\s*/g, "$1").replace(/\s*\([^)]*\)/g, "");
  const base = type.replace(/\[\]$/, "");
  const canonical = TYPE_ALIAS_GROUPS.find((group) => group.includes(base))?.[0] ?? base;
  return canonical + (type.endsWith("[]") ? "[]" : "");
}

function closingParen(tokens: SqlToken[], open: number): number {
  let depth = 0;
  for (let i = open; i < tokens.length; i++) {
    if (tokens[i].text === "(") depth++;
    if (tokens[i].text === ")") depth--;
    if (depth === 0) return i;
  }
  throw new Error("SQL: firma de función sin cierre");
}

function isFunctionStart(tokens: SqlToken[], index: number): boolean {
  const expected = ["create", "or", "replace", "function", "public", "."];
  return expected.every((word, offset) => tokens[index + offset]?.text.toLowerCase() === word)
    && tokens[index + 6]?.kind === "word" && tokens[index + 7]?.text === "(";
}

function normalizedDefinition(sql: string, tokens: SqlToken[]): string {
  const bodyIndex = tokens.findIndex((t, i) => t.kind === "dollar" && /^as$/i.test(tokens[i - 1]?.text));
  if (bodyIndex < 0) return JSON.stringify([normalizeSql(sql)]);
  const token = tokens[bodyIndex];
  const tag = /^\$[^$]*\$/.exec(token.text)![0];
  const body = token.text.slice(tag.length, -tag.length);
  const languageIndex = tokens.findIndex((t) => /^language$/i.test(t.text));
  const language = tokens[languageIndex + 1]?.text.toLowerCase();
  // Only SQL and PL/pgSQL share this comment/literal grammar. Other languages
  // retain their body byte-for-byte; inner dollar strings are always opaque.
  const normalizedBody = language === "sql" || language === "plpgsql" ? normalizeSql(body) : body;
  const offset = tokens[0].start;
  return JSON.stringify([
    normalizeSql(sql.slice(0, token.start - offset)),
    normalizedBody,
    normalizeSql(sql.slice(token.end - offset)),
  ]);
}

/**
 * Read top-level CREATE OR REPLACE FUNCTION declarations; quoted SQL and DO
 * bodies are opaque. The terminal semicolon and schema dump name metadata are
 * not function attributes. Options after the body (LANGUAGE, etc.) are included.
 * This is a static source guard, not an interpreter for ALTER/DROP/dynamic SQL.
 */
export function extraerFunciones(src: string): DefinicionFuncion[] {
  const tokens = significantTokens(src);
  const result: DefinicionFuncion[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!isFunctionStart(tokens, i)) continue;
    const nombre = tokens[i + 6].text.toLowerCase();
    const close = closingParen(tokens, i + 7);
    const argTypes = splitArgs(tokens.slice(i + 8, close)).map(argumentType).filter((t) => t !== null);
    let end = close + 1;
    while (end < tokens.length && tokens[end].text !== ";") end++;
    if (end === tokens.length) throw new Error(`SQL: declaración ${nombre} sin terminador`);
    let definitionEnd = end;
    // pg_get_functiondef mirrors carry `name:<fn> schema:public` after the body.
    const metadata = tokens.slice(end - 6, end).map((t) => t.text).join(" ");
    if (metadata === `name : ${nombre} schema : public`) definitionEnd -= 6;
    const statementTokens = tokens.slice(i, definitionEnd);
    const statement = src.slice(tokens[i].start, statementTokens.at(-1)!.end);
    result.push({ nombre, firma: `${nombre}(${argTypes.join(",")})`, cuerpo: normalizedDefinition(statement, statementTokens) });
    i = end;
  }
  return result;
}
