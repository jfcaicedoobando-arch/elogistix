import { createHash } from "node:crypto";
import { extractParenArgs, normalizeArgTypes, stripSqlComments, type Violation } from "./audit-sql-signatures";

export interface DrizzleReplayEntry {
  file: string;
  sha256: string;
  replays: string[];
}

/** Bodies only: this is a coverage guard, not a SQL parser or a live DB audit. */
function functions(sql: string): Map<string, string> {
  const out = new Map<string, string>();
  const regex = /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.(\w+)\s*\(/gi;
  const declarations = [...stripSqlComments(sql).matchAll(regex)];
  const cleaned = stripSqlComments(sql);
  for (const [index, match] of declarations.entries()) {
    const chunk = cleaned.slice(match.index, declarations[index + 1]?.index);
    const signature = extractParenArgs(chunk, match[0].length - 1);
    if (!signature) continue;
    const rest = chunk.slice(signature.endIdx + 1);
    const body = /\bAS\s+(\$\w*\$)([\s\S]*?)\1\s*;/i.exec(rest);
    if (!body) continue;
    const args = normalizeArgTypes(signature.args).replace(/\btimestamptz\b/g, "timestamp with time zone");
    out.set(`${match[1]}(${args})`, body[2].replace(/\s+/g, " ").trim());
  }
  return out;
}

/** Every immutable Drizzle SQL must have an explicitly reviewed Supabase replay. */
export function scanDrizzleReplay(
  drizzle: Map<string, string>,
  supabase: Map<string, string>,
  entries: DrizzleReplayEntry[],
): Violation[] {
  const out: Violation[] = [];
  for (const [file, sql] of [...drizzle].sort(([a], [b]) => a.localeCompare(b))) {
    const mapping = entries.filter((entry) => entry.file === file);
    const hash = createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
    if (mapping.length !== 1 || mapping[0].sha256 !== hash) {
      out.push({ file: `drizzle/migrations/${file}`, check: "DR1", detail: "falta un replay revisado único o cambió el hash del SQL inmutable" });
    } else if (mapping[0].replays.length === 0 || mapping[0].replays.some((name) => !supabase.has(name))) {
      out.push({ file: `drizzle/migrations/${file}`, check: "DR2", detail: "el replay declarado no existe en supabase/migrations" });
    }
    const parsed = functions(sql);
    const count = [...stripSqlComments(sql).matchAll(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\./gi)].length;
    if (count !== parsed.size) {
      out.push({ file: `drizzle/migrations/${file}`, check: "DR3", detail: "firma de función no soportada: ampliar el parser y sus pruebas, no omitirla" });
    }
    // Compare the declared historical replay, not all future migrations:
    // a later corrective migration must not require editing immutable Drizzle SQL.
    const declared = new Map<string, string>();
    for (const target of [...(mapping[0]?.replays ?? [])].sort()) {
      for (const [key, body] of functions(supabase.get(target) ?? "")) declared.set(key, body);
    }
    for (const [key, body] of parsed) {
      if (declared.get(key) !== body) {
        out.push({ file: `drizzle/migrations/${file}`, check: "DR4", detail: `${key} no coincide con su replay declarado` });
      }
    }
  }
  for (const entry of entries) {
    if (!drizzle.has(entry.file)) out.push({ file: "drizzle/replay.json", check: "DR5", detail: `entrada sin SQL: ${entry.file}` });
  }
  return out;
}
