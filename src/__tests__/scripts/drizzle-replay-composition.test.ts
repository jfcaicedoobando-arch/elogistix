import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { scanDrizzleReplay, type DrizzleReplayEntry } from "../../../scripts/lib/audit-drizzle-replay";

const hash = (sql: string) => createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");
const first = "0008_first.sql";
const last = "0009_last.sql";
const target = "20261006214500_composed.sql";
const preamble = "-- Exact replay of two immutable sources.\n";
const definition = (value: string) => `CREATE OR REPLACE FUNCTION public.example(p_id uuid) RETURNS text LANGUAGE sql AS $$ SELECT '${value}' $$;`;

function fixture() {
  const firstSql = `${definition("old")}\nCREATE OR REPLACE FUNCTION public.retained() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;`;
  const lastSql = definition("final");
  const replay = preamble + firstSql + "\n" + lastSql;
  const entries: DrizzleReplayEntry[] = [
    { file: first, sha256: hash(firstSql), replays: [target], composition: {
      sources: [first, last], replaySha256: hash(replay), preamble,
    } },
    { file: last, sha256: hash(lastSql), replays: [target] },
  ];
  const sources = new Map([[first, firstSql], [last, lastSql]]);
  const replays = new Map([[target, replay]]);
  return { sources, replays, entries, composition: entries[0].composition!,
    scan: () => scanDrizzleReplay(sources, replays, entries) };
}

function repin(f: ReturnType<typeof fixture>, sql: string) {
  f.replays.set(target, sql);
  f.composition.replaySha256 = hash(sql);
}

describe("strict immutable Drizzle replay composition", () => {
  it("accepts exact ordered sources and compares the final body for each signature", () => {
    expect(fixture().scan()).toEqual([]);
  });
  it("preserves ordinary DR4 when no exact composition is declared", () => {
    const f = fixture();
    delete f.entries[0].composition;
    expect(f.scan()).toEqual([{ file: `drizzle/migrations/${first}`, check: "DR4",
      detail: "example(uuid) no coincide con su replay declarado" }]);
  });
  it("normalizes only checkout CRLF, preserving immutable Git/LF hashes", () => {
    const f = fixture();
    for (const [file, sql] of f.sources) f.sources.set(file, sql.replace(/\n/g, "\r\n"));
    f.replays.set(target, f.replays.get(target)!.replace(/\n/g, "\r\n"));
    expect(f.scan()).toEqual([]);
  });
  it("rejects reversed source order even with exact concatenation and a repinned replay", () => {
    const f = fixture();
    f.composition.sources.reverse();
    repin(f, preamble + f.sources.get(last)! + "\n" + f.sources.get(first)!);
    expect(f.scan().some((v) => v.check === "DR6")).toBe(true);
  });
  it("rejects replay order changes even when the replay hash is repinned", () => {
    const f = fixture();
    repin(f, preamble + f.sources.get(last)! + "\n" + f.sources.get(first)!);
    expect(f.scan().some((v) => v.check === "DR6")).toBe(true);
  });
  it("rejects an edited immutable source independently of replay content", () => {
    const f = fixture();
    f.sources.set(first, f.sources.get(first)! + "\n-- edit");
    repin(f, preamble + f.sources.get(first)! + "\n" + f.sources.get(last)!);
    expect(f.scan().some((v) => v.check === "DR6")).toBe(true);
    expect(f.scan().some((v) => v.check === "DR1")).toBe(true);
  });
  it("rejects an incorrect replay hash", () => {
    const f = fixture();
    f.composition.replaySha256 = "0".repeat(64);
    expect(f.scan().some((v) => v.check === "DR6")).toBe(true);
  });
  it.each([
    ["changed DDL", "\nALTER TABLE public.example ADD COLUMN unexpected text;"],
    ["extra whitespace", "\n"],
    ["wrong final definition", "\n" + definition("wrong")],
    ["older final definition", "\n" + definition("old")],
  ])("rejects %s despite a repinned replay hash", (_label, suffix) => {
    const f = fixture();
    repin(f, f.replays.get(target)! + suffix);
    expect(f.scan().some((v) => v.check === "DR6")).toBe(true);
  });
  it("rejects a replaced final body and retains DR4 on the last source", () => {
    const f = fixture();
    repin(f, f.replays.get(target)!.replace("SELECT 'final'", "SELECT 'wrong'"));
    expect(f.scan().some((v) => v.check === "DR6")).toBe(true);
    expect(f.scan().some((v) => v.check === "DR4" && v.file.endsWith(last))).toBe(true);
  });
  it("rejects omitted historical content even when final definitions match", () => {
    const f = fixture();
    repin(f, preamble + f.sources.get(last)!);
    expect(f.scan().some((v) => v.check === "DR6")).toBe(true);
  });
  it.each([[first], [first, first], [first, "missing.sql"]])("rejects invalid source list %j", (...sources) => {
    const f = fixture();
    f.composition.sources = sources;
    expect(f.scan().some((v) => v.check === "DR6")).toBe(true);
  });
  it("rejects skipped intermediate sources", () => {
    const f = fixture();
    f.sources.set("0008_middle.sql", "SELECT 1;");
    expect(f.scan().some((v) => v.check === "DR6")).toBe(true);
  });
  it("rejects duplicate ownership rather than selecting a permissive mapping", () => {
    const f = fixture();
    f.entries.push(structuredClone(f.entries[0]));
    expect(f.scan().some((v) => v.check === "DR6")).toBe(true);
    expect(f.scan().some((v) => v.check === "DR1")).toBe(true);
  });
  it("rejects a second composition claiming the same sources", () => {
    const f = fixture();
    f.entries[1].composition = structuredClone(f.composition);
    expect(f.scan().some((v) => v.check === "DR6")).toBe(true);
  });
  it("requires each source to map exclusively to the exact replay", () => {
    const f = fixture();
    f.entries[1].replays.push("20261006214600_later.sql");
    f.replays.set("20261006214600_later.sql", f.sources.get(last)!);
    expect(f.scan().some((v) => v.check === "DR6")).toBe(true);
  });
  it("rejects missing source entries and missing replay files", () => {
    const f = fixture();
    f.entries.pop();
    expect(f.scan().some((v) => v.check === "DR6")).toBe(true);
    const missingReplay = fixture();
    missingReplay.replays.clear();
    expect(missingReplay.scan().some((v) => v.check === "DR6")).toBe(true);
    expect(missingReplay.scan().some((v) => v.check === "DR2")).toBe(true);
  });
  it.each(["SELECT 1;\n", "/* unclosed comment\n", "-- missing newline"])("rejects executable or incomplete preamble %j", (header) => {
    const f = fixture();
    f.composition.preamble = header;
    repin(f, header + f.sources.get(first)! + "\n" + f.sources.get(last)!);
    expect(f.scan().some((v) => v.check === "DR6")).toBe(true);
  });
  it("does not exempt unsupported source function declarations from DR3", () => {
    const f = fixture();
    const unsupported = "CREATE OR REPLACE FUNCTION public.unsupported() RETURNS int LANGUAGE sql AS 'SELECT 1';";
    f.sources.set(last, unsupported);
    f.entries[1].sha256 = hash(unsupported);
    repin(f, preamble + f.sources.get(first)! + "\n" + unsupported);
    expect(f.scan().some((v) => v.check === "DR3")).toBe(true);
  });
});
