import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scanFile } from "@/../scripts/audit-migrations";
import { scanDrizzleReplay, type DrizzleReplayEntry } from "@/../scripts/lib/audit-drizzle-replay";

const sourceFile = "0019_cxp_contador_autoaprobacion.sql";
const replayFile = "20261013195000_cxp_contador_autoaprobacion.sql";
const sourceHash = "b86955edc5440a0b4d4c5599494abca193876589761f905f7512738ef48179ad";
const replayHash = "07dc064e1f8457aed5d7afc12afef3ffb439134601310c11b5b3cf5456f2fbaa";
const read = (path: string) => readFileSync(path, "utf8");
const hash = (sql: string) => createHash("sha256").update(sql).digest("hex");
const source = read(`drizzle/migrations/${sourceFile}`);
const replay = read(`supabase/migrations/${replayFile}`);
const entries = JSON.parse(read("drizzle/replay.json")) as DrizzleReplayEntry[];
const mapping = entries.filter((entry) => entry.file === sourceFile);
const drizzle = new Map([[sourceFile, source]]);
const supabase = new Map([[replayFile, replay]]);

describe("0019 CxP reuses the reviewed historical replay", () => {
  it("pins immutable SQL bytes and one ordinary mapping to the existing migration", () => {
    expect(Buffer.byteLength(source)).toBe(7999);
    expect(hash(source)).toBe(sourceHash);
    expect(hash(replay)).toBe(replayHash);
    expect(mapping).toEqual([{ file: sourceFile, sha256: sourceHash, replays: [replayFile] }]);
    expect(scanDrizzleReplay(drizzle, supabase, mapping)).toEqual([]);
    expect(scanFile(replayFile, replay)).toEqual([]);
  });

  it("preserves every byte of preflight, function, ACL and postcheck except the transport transaction", () => {
    // Drizzle supplies the enclosing transaction; retain all nested PL/pgSQL blocks.
    const transported = replay
      .replace("\nBEGIN;\nCREATE TEMP TABLE cxp_autoaprobacion_20261013195000_before", "\nCREATE TEMP TABLE cxp_autoaprobacion_20261013195000_before")
      .replace(/\nCOMMIT;\n$/, "\n");
    expect(Buffer.byteLength(replay) - Buffer.byteLength(source)).toBe(15);
    expect(transported).toBe(source);
  });

  it.each([
    ["missing mapping", []],
    ["duplicate mapping", [...mapping, ...mapping]],
    ["stale source hash", mapping.map((entry) => ({ ...entry, sha256: "0".repeat(64) }))],
  ])("still rejects %s through DR1", (_name, reviewed) => {
    expect(scanDrizzleReplay(drizzle, supabase, reviewed).some(({ check }) => check === "DR1")).toBe(true);
  });

  it("still rejects a missing replay through DR2", () => {
    expect(scanDrizzleReplay(drizzle, new Map(), mapping).some(({ check }) => check === "DR2")).toBe(true);
  });

  it("still rejects changed source bytes and function drift through DR1 and DR4", () => {
    const changed = source.replace("AND NOT v_puede_autoaprobar_cxp", "AND v_puede_autoaprobar_cxp");
    expect(changed).not.toBe(source);
    expect(scanDrizzleReplay(new Map([[sourceFile, changed]]), supabase, mapping).map(({ check }) => check)).toEqual(["DR1", "DR4"]);
    expect(scanDrizzleReplay(drizzle, new Map([[replayFile, changed]]), mapping).map(({ check }) => check)).toEqual(["DR4"]);
  });
});
