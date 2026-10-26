import { readIsolatedDrizzleReplay } from "../../../scripts/ci/drizzle-history/control.mjs";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { scanDrizzleReplay, type DrizzleReplayEntry } from "@/../scripts/lib/audit-drizzle-replay";
import { scanFile } from "@/../scripts/audit-migrations";
import { extractDumpFunction } from "@/test/helpers/extractDumpFunction";

const sourceFile = "0014_demo_seed_limpia_agentes.sql";
const replayFile = "20261013204000_replay_demo_seed_limpia_agentes.sql";
const oldFile = "20260813034917_77eaff78-8a60-4633-a064-fab701c09d64.sql";
const sourceHash = "9176c0041c2095ccfa3f8a31ce5651706e243da8ddd371df1b6f4b2ab1fb3fb0";
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const source = read(`drizzle/migrations/${sourceFile}`);
const replay = read(`supabase/migrations/${replayFile}`);
const entries = JSON.parse(read("drizzle/replay.json")) as DrizzleReplayEntry[];
const mapping = entries.filter((entry) => entry.file === sourceFile);
const drizzle = new Map([[sourceFile, source]]);
const supabase = new Map([[replayFile, replay]]);
const checks = (result: ReturnType<typeof scanDrizzleReplay>) => result.map((v) => v.check);
const migrations = new Map(readdirSync(resolve(process.cwd(), "supabase/migrations"))
  .filter((file) => file.endsWith(".sql"))
  .map((file) => [file, read(`supabase/migrations/${file}`)]));

// These are source/guard contracts. Runtime tenant/FK safety needs the SQL suite.
describe("immutable demo 0014 has a real, ACL-closed Supabase replay", () => {
  it("pins immutable bytes and one ordinary reviewed mapping", () => {
    expect(Buffer.byteLength(source)).toBe(1738);
    expect(createHash("sha256").update(source).digest("hex")).toBe(sourceHash);
    expect(mapping).toEqual([{ file: sourceFile, sha256: sourceHash, replays: [replayFile] }]);
    expect(entries.filter((entry) => entry.replays.includes(replayFile))).toHaveLength(1);
    expect(replay.slice(0, source.length)).toBe(source);
    expect(replay.slice(source.length)).not.toMatch(/CREATE|ALTER|DROP\s+FUNCTION/i);
  });
  it("runs the real guard against every immutable source and declared replay", () => {
    const allDrizzle = new Map(readdirSync(resolve(process.cwd(), "drizzle/migrations"))
      .filter((file) => file.endsWith(".sql"))
      .map((file) => [file, read(`drizzle/migrations/${file}`)]));
    expect(scanDrizzleReplay(allDrizzle, migrations, entries, readIsolatedDrizzleReplay())).toEqual([]);
  });
  it("reports missing mapping and missing declared replay", () => {
    expect(checks(scanDrizzleReplay(drizzle, supabase, []))).toEqual(["DR1", "DR4"]);
    expect(checks(scanDrizzleReplay(drizzle, new Map(), mapping))).toEqual(["DR2", "DR4"]);
  });
  it("rejects the old body even when the source hash is right", () => {
    expect(checks(scanDrizzleReplay(drizzle, new Map([[oldFile, migrations.get(oldFile)!]]),
      [{ ...mapping[0], replays: [oldFile] }]))).toEqual(["DR4"]);
  });
  it("accepts the actual new replay without weakening the scanner", () => {
    expect(scanDrizzleReplay(drizzle, supabase, mapping)).toEqual([]);
    expect(scanFile(replayFile, replay)).toEqual([]);
  });
  it("still rejects changed source bytes, duplicate mappings and stale hashes", () => {
    expect(checks(scanDrizzleReplay(new Map([[sourceFile, source + "\n"]]), supabase, mapping))).toContain("DR1");
    expect(checks(scanDrizzleReplay(drizzle, supabase, [...mapping, ...mapping]))).toContain("DR1");
    expect(checks(scanDrizzleReplay(drizzle, supabase, [{ ...mapping[0], sha256: "0".repeat(64) }]))).toContain("DR1");
  });
  it("still rejects drift in the declared cleanup body", () => {
    const drifted = replay.replace("DELETE FROM public.costeo_agentes WHERE organization_id = v_org;", "PERFORM 1;");
    expect(drifted).not.toBe(replay);
    expect(checks(scanDrizzleReplay(drizzle, new Map([[replayFile, drifted]]), mapping))).toEqual(["DR4"]);
  });
  it("preserves the historical ACL and keeps H6 sensitive to missing ACL or PUBLIC grants", () => {
    const grants = (sql: string) => sql.match(/(?:REVOKE ALL|GRANT EXECUTE) ON FUNCTION public\.seed_demo_organization_guarded\(bigint\)[^;]+;/g);
    expect(grants(replay)).toEqual(grants(migrations.get(oldFile)!));
    expect(checks(scanFile(replayFile, source))).toContain("H6");
    expect(checks(scanFile(replayFile, replay + "\nGRANT EXECUTE ON FUNCTION public.seed_demo_organization_guarded(bigint) TO PUBLIC;"))).toContain("H6");
  });
  it("aligns canonical SQL and the expected normalized dump body exactly", () => {
    const forward = read("supabase/migrations/20261015050000_disable_demo_reseed.sql");
    expect(extractDumpFunction(read("supabase/schema/security/seed_demo_organization_guarded.sql"), "public.seed_demo_organization_guarded").body).toBe(extractDumpFunction(forward, "public.seed_demo_organization_guarded").body);
    const baseline = read("supabase/schema/baseline.sql");
    const actual = extractDumpFunction(baseline, "public.seed_demo_organization_guarded").body;
    const expected = extractDumpFunction(forward, "public.seed_demo_organization_guarded").body;
    expect(actual).toBe(expected.split("\n").filter((line) => line.trim()).join("\n") + "\n");
  });
  it("uses a unique, forward timestamp and includes it in the active release", () => {
    const timestamp = replayFile.slice(0, 14);
    expect([...migrations.keys()].filter((file) => file.startsWith(timestamp))).toEqual([replayFile]);
    expect(replayFile > oldFile).toBe(true);
    const version = read("src/constants/appVersion.ts").match(/APP_VERSION\s*=\s*"([^"]+)"/)![1];
    const manifest = JSON.parse(read("supabase/releases/migration-manifest.json"));
    expect(manifest[version].migrations).toEqual([...migrations.keys()].sort());
  });
});
