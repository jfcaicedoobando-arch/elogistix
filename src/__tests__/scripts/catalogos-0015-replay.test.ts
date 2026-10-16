import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scanDrizzleReplay, type DrizzleReplayEntry } from "@/../scripts/lib/audit-drizzle-replay";
import { scanFile } from "@/../scripts/audit-migrations";

const sourceFile = "0015_catalogos_alta_gerente_admin.sql";
const replayFile = "20261014173500_replay_catalogos_alta_gerente_admin.sql";
const sourceHash = "81f927057fc37030232c88ffc8b5e4bf51f46df6948f07fc50c57df41b0ac93c";
const read = (file: string) => readFileSync(file, "utf8");
const source = read(`drizzle/migrations/${sourceFile}`);
const replay = read(`supabase/migrations/${replayFile}`);
const entries = JSON.parse(read("drizzle/replay.json")) as DrizzleReplayEntry[];
const policies = (sql: string) => sql.match(/CREATE POLICY[^;]+;/g);

const introductionVersion = "13.824.83";
const historicalHash = "da5120363c4cc4be36cf6477921bda243d700a4f066f06f75bb99d15ceda7449";
type MigrationManifest = Record<string, { migrations: string[] }>;
const readManifest = () => JSON.parse(read("supabase/releases/migration-manifest.json")) as MigrationManifest;

function assertReleaseInventory(manifest: MigrationManifest, version: string, migrations: string[]) {
  const historical = Object.fromEntries(Object.entries(manifest)
    .filter(([key]) => key.localeCompare(introductionVersion, "en", { numeric: true }) < 0));
  expect(Object.keys(historical)).toHaveLength(47);
  expect(createHash("sha256").update(JSON.stringify(historical)).digest("hex")).toBe(historicalHash);
  expect(manifest[introductionVersion]?.migrations).toContain(replayFile);
  for (const [key, entry] of Object.entries(manifest)) {
    if (key.localeCompare(introductionVersion, "en", { numeric: true }) >= 0) {
      expect(entry.migrations).toContain(replayFile);
    }
  }
  expect(migrations).toContain(replayFile);
  expect(manifest[version]?.migrations).toEqual(migrations);
}

describe("catalogs 0015 historical policies have an exact, idempotent replay", () => {
  it("preserves the immutable source and its unique mapping", () => {
    expect(createHash("sha256").update(source).digest("hex")).toBe(sourceHash);
    expect(entries.filter((entry) => entry.file === sourceFile))
      .toEqual([{ file: sourceFile, sha256: sourceHash, replays: [replayFile] }]);
    expect(entries.filter((entry) => entry.replays.includes(replayFile))).toHaveLength(1);
    expect(scanDrizzleReplay(new Map([[sourceFile, source]]), new Map([[replayFile, replay]]),
      entries.filter((entry) => entry.file === sourceFile))).toEqual([]);
  });

  it("keeps all three policy statements byte-exact, including names, roles and enum casts", () => {
    expect(policies(source)).toHaveLength(3);
    expect(policies(replay)).toEqual(policies(source));
    expect(replay).not.toMatch(/\b(?:GRANT|REVOKE|ALTER POLICY|CREATE TYPE|ALTER TYPE|CREATE(?: OR REPLACE)? FUNCTION)\b/);
    // H4 remains enforced; each DROP is inside the missing-policy branch,
    // under the table locks, so a matching existing policy is never replaced.
    expect(replay.match(/DROP POLICY IF EXISTS /g)).toHaveLength(3);
    expect(scanFile(replayFile, replay)).toEqual([]);
  });

  it("checks every existing policy attribute before conditionally creating policies", () => {
    expect(replay).toContain("v_policy.polcmd IS DISTINCT FROM 'a'");
    expect(replay).toContain("v_policy.polpermissive IS DISTINCT FROM true");
    expect(replay).toContain("v_policy.polroles IS DISTINCT FROM ARRAY[v_authenticated]::oid[]");
    expect(replay).toContain("v_policy.polqual IS NOT NULL");
    expect(replay).toContain("pg_get_expr(v_policy.polwithcheck, v_policy.polrelid) IS DISTINCT FROM v_expected_check");
    expect(replay).toContain("CATALOGOS_0015_POLICY_DRIFT");
    expect(replay.indexOf("CATALOGOS_0015_POLICY_DRIFT")).toBeLessThan(replay.indexOf("CREATE POLICY"));
    expect(replay.match(/IF NOT EXISTS \(SELECT 1 FROM pg_catalog\.pg_policy/g)).toHaveLength(3);
    expect(replay).toContain("PERFORM set_config('search_path', v_previous_search_path, true)");
  });

  it("uses one forward timestamp and updates only the active migration inventory", () => {
    const migrations = readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql")).sort();
    expect(migrations.filter((file) => file.startsWith(replayFile.slice(0, 14)))).toEqual([replayFile]);
    expect(replayFile > "20261013210000_guard_demo_cleanup_tenant_graph.sql").toBe(true);
    const version = read("src/constants/appVersion.ts").match(/APP_VERSION\s*=\s*"([^"]+)"/)![1];
    assertReleaseInventory(readManifest(), version, migrations);
  });

  it("allows release 13.824.84 to retain the replay and match its current disk inventory", () => {
    const manifest = readManifest();
    const current = readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql")).sort();
    // A later release may add a migration while the introduction stays frozen.
    const nextDisk = [...current, "20261015000000_next_release_fixture.sql"].sort();
    const next: MigrationManifest = { ...manifest, "13.824.84": { migrations: nextDisk } };
    assertReleaseInventory(next, "13.824.84", nextDisk);
    expect(next[introductionVersion]).toEqual(manifest[introductionVersion]);
    expect(() => assertReleaseInventory(next, "13.824.84", current)).toThrow();
  });

  it("still rejects changed historical entries or a later release omitting the replay", () => {
    const manifest = readManifest();
    const current = readdirSync("supabase/migrations").filter((file) => file.endsWith(".sql")).sort();
    const changed = structuredClone(manifest);
    changed[Object.keys(changed)[0]].migrations.pop();
    expect(() => assertReleaseInventory(changed, introductionVersion, current)).toThrow();
    const next: MigrationManifest = { ...manifest, "13.824.84": {
      migrations: current.filter((file) => file !== replayFile),
    } };
    expect(() => assertReleaseInventory(next, "13.824.84", current)).toThrow();
  });
});
