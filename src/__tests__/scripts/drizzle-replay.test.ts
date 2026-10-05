import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { scanDrizzleReplay, type DrizzleReplayEntry } from "../../../scripts/lib/audit-drizzle-replay";

const file = "0000_example.sql";
const target = "20261006000100_example.sql";
const sql = "CREATE OR REPLACE FUNCTION public.example(p_id uuid) RETURNS text LANGUAGE sql AS $$ SELECT 'ok' $$;\n";
const entry: DrizzleReplayEntry = { file, sha256: createHash("sha256").update(sql).digest("hex"), replays: [target] };
const source = new Map([[file, sql]]);
const replay = new Map([[target, sql]]);

describe("Drizzle replay coverage", () => {
  it("accepts an immutable migration with matching replay", () => {
    expect(scanDrizzleReplay(source, replay, [entry])).toEqual([]);
  });
  it("normalizes checkout CRLF before comparing the Git/Lovable hash", () => {
    expect(scanDrizzleReplay(new Map([[file, sql.replace(/\n/g, "\r\n")]]), replay, [entry])).toEqual([]);
  });
  it("rejects a new migration without a reviewed replay mapping", () => {
    expect(scanDrizzleReplay(source, replay, []).some((v) => v.check === "DR1")).toBe(true);
  });
  it("rejects edits to applied SQL and duplicate mappings", () => {
    expect(scanDrizzleReplay(new Map([[file, sql + "-- edited\n"]]), replay, [entry]).some((v) => v.check === "DR1")).toBe(true);
    expect(scanDrizzleReplay(source, replay, [entry, entry]).some((v) => v.check === "DR1")).toBe(true);
  });
  it("requires replay files and rejects stale mappings", () => {
    expect(scanDrizzleReplay(source, new Map(), [entry]).some((v) => v.check === "DR2")).toBe(true);
    expect(scanDrizzleReplay(new Map(), replay, [entry]).some((v) => v.check === "DR5")).toBe(true);
  });
  it("compares against the latest declared replay, not an older matching body", () => {
    const changed = new Map([...replay, ["20261006000200_new.sql", sql.replace("'ok'", "'wrong'")]]);
    const mapping = { ...entry, replays: [target, "20261006000200_new.sql"] };
    expect(scanDrizzleReplay(source, changed, [mapping]).some((v) => v.check === "DR4")).toBe(true);
  });
  it("allows later corrective migrations without rewriting applied Drizzle SQL", () => {
    const changed = new Map([...replay, ["20261006000200_new.sql", sql.replace("'ok'", "'corrected'")]]);
    expect(scanDrizzleReplay(source, changed, [entry])).toEqual([]);
  });
  it("does not silently ignore unsupported argument signatures", () => {
    const unsupported = sql.replace("$$ SELECT 'ok' $$", "'SELECT 1'");
    expect(scanDrizzleReplay(new Map([[file, unsupported]]), replay, [entry]).some((v) => v.check === "DR3")).toBe(true);
  });
  it("supports numeric argument modifiers without truncating the signature", () => {
    const modified = sql.replace("p_id uuid", "p_amount numeric(12,2)");
    const mapping = { ...entry, sha256: createHash("sha256").update(modified).digest("hex") };
    expect(scanDrizzleReplay(new Map([[file, modified]]), new Map([[target, modified]]), [mapping])).toEqual([]);
  });
});
