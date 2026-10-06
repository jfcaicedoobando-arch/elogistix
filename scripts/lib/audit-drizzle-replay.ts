import { createHash } from "node:crypto";
import { extractParenArgs, normalizeArgTypes, stripSqlComments, type Violation } from "./audit-sql-signatures";

export interface DrizzleReplayEntry {
  file: string;
  sha256: string;
  replays: string[];
  /** Only the first source owns a byte-exact, ordered historical composition. */
  composition?: {
    sources: string[];
    replaySha256: string;
    preamble: string;
  };
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

function lf(sql: string): string {
  return sql.replace(/\r\n/g, "\n");
}

function sha256(sql: string): string {
  return createHash("sha256").update(lf(sql)).digest("hex");
}

function validSourceList(sources: string[], drizzle: Map<string, string>): boolean {
  return Array.isArray(sources) && sources.length >= 2
    && sources.every((file) => typeof file === "string" && drizzle.has(file))
    && new Set(sources).size === sources.length;
}

function sourceMappingMatches(file: string, target: string, drizzle: Map<string, string>, entries: DrizzleReplayEntry[]): boolean {
  const mapping = entries.filter((entry) => entry.file === file);
  return mapping.length === 1 && mapping[0].sha256 === sha256(drizzle.get(file)!)
    && mapping[0].replays.length === 1 && mapping[0].replays[0] === target;
}

function compositionSourceErrors(owner: DrizzleReplayEntry, drizzle: Map<string, string>, entries: DrizzleReplayEntry[]): string[] {
  const { sources } = owner.composition!;
  if (!validSourceList(sources, drizzle)) return ["orígenes ausentes, duplicados o menos de dos"];
  const errors: string[] = [];
  const ordered = [...drizzle.keys()].sort((a, b) => a.localeCompare(b));
  const start = ordered.indexOf(sources[0]);
  if (owner.file !== sources[0] || sources.some((file, index) => ordered[start + index] !== file)) {
    errors.push("los orígenes deben ser consecutivos y respetar el orden inmutable");
  }
  const owners = entries.filter((entry) => entry.composition);
  if (sources.some((file) => owners.some((other) => other !== owner && other.composition?.sources?.includes(file)))) {
    errors.push("un origen pertenece a más de una composición");
  }
  const target = owner.replays[0];
  for (const file of sources) {
    if (!sourceMappingMatches(file, target, drizzle, entries)) errors.push(`hash o mapping exclusivo inválido: ${file}`);
  }
  if (entries.some((entry) => entry.replays.includes(target) && !sources.includes(entry.file))) {
    errors.push("el replay está declarado por un origen fuera de la composición");
  }
  return errors;
}

function isCommentPreamble(preamble: string): boolean {
  return typeof preamble === "string" && preamble.endsWith("\n") && !preamble.includes("\r")
    && preamble.split("\n").every((line) => line.trim() === "" || line.trimStart().startsWith("--"));
}

function compositionReplayErrors(owner: DrizzleReplayEntry, drizzle: Map<string, string>, supabase: Map<string, string>): string[] {
  const { sources, preamble, replaySha256 } = owner.composition!;
  const errors: string[] = [];
  // Only complete line comments/blank lines may precede the immutable sources.
  if (!isCommentPreamble(preamble)) errors.push("el preámbulo debe contener solo comentarios de línea completos");
  const replay = supabase.get(owner.replays[0]);
  if (owner.replays.length !== 1 || replay === undefined
    || !/^[a-f0-9]{64}$/.test(replaySha256) || sha256(replay) !== replaySha256) {
    errors.push("replay único ausente o SHA-256 incorrecto");
  }
  if (validSourceList(sources, drizzle) && typeof preamble === "string" && replay !== undefined
    && lf(replay) !== preamble + sources.map((file) => lf(drizzle.get(file)!)).join("\n")) {
    errors.push("el replay no es la concatenación exacta y ordenada de los orígenes");
  }
  return errors;
}

/** A composition never exempts SQL: every byte and source mapping must verify first. */
function verifiedCompositions(
  drizzle: Map<string, string>,
  supabase: Map<string, string>,
  entries: DrizzleReplayEntry[],
  violations: Violation[],
): Map<string, Map<string, string>> {
  const verified = new Map<string, Map<string, string>>();
  for (const owner of entries.filter((entry) => entry.composition)) {
    const errors = [...compositionSourceErrors(owner, drizzle, entries), ...compositionReplayErrors(owner, drizzle, supabase)];
    if (errors.length) {
      violations.push({ file: "drizzle/replay.json", check: "DR6", detail: `${owner.file}: ${errors.join("; ")}` });
      continue;
    }
    // PostgreSQL keeps the last definition of each signature, in source order.
    const finalBodies = new Map<string, string>();
    for (const file of owner.composition!.sources) {
      for (const [key, body] of functions(drizzle.get(file)!)) finalBodies.set(key, body);
    }
    for (const file of owner.composition!.sources) verified.set(file, finalBodies);
  }
  return verified;
}

function scanMapping(file: string, hash: string, mapping: DrizzleReplayEntry[], supabase: Map<string, string>): Violation[] {
  if (mapping.length !== 1 || mapping[0].sha256 !== hash) {
    return [{ file: `drizzle/migrations/${file}`, check: "DR1", detail: "falta un replay revisado único o cambió el hash del SQL inmutable" }];
  }
  if (mapping[0].replays.length === 0 || mapping[0].replays.some((name) => !supabase.has(name))) {
    return [{ file: `drizzle/migrations/${file}`, check: "DR2", detail: "el replay declarado no existe en supabase/migrations" }];
  }
  return [];
}

/** Every immutable Drizzle SQL must have an explicitly reviewed Supabase replay. */
export function scanDrizzleReplay(
  drizzle: Map<string, string>,
  supabase: Map<string, string>,
  entries: DrizzleReplayEntry[],
): Violation[] {
  const out: Violation[] = [];
  const composed = verifiedCompositions(drizzle, supabase, entries, out);
  for (const [file, sql] of [...drizzle].sort(([a], [b]) => a.localeCompare(b))) {
    const mapping = entries.filter((entry) => entry.file === file);
    const hash = sha256(sql);
    out.push(...scanMapping(file, hash, mapping, supabase));
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
    // Ordinary mappings retain DR4 unchanged; exact compositions compare final bodies.
    for (const [key, body] of composed.get(file) ?? parsed) {
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
