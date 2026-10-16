import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scanFile } from "@/../scripts/audit-migrations";
import { scanDrizzleReplay, type DrizzleReplayEntry } from "@/../scripts/lib/audit-drizzle-replay";

const sourceFile = "0018_cargos_tarifario_aplica_iva.sql";
const replayFile = "20261014203100_replay_cargos_tarifario_aplica_iva.sql";
const sourceHash = "e54c5f4dce851c8d30d3c71336c315ae7b600c72a5a5cc1d5194b908cbbbadee";
const read = (path: string) => readFileSync(path, "utf8");
const source = read(`drizzle/migrations/${sourceFile}`);
const replay = read(`supabase/migrations/${replayFile}`);
const expected = [
  "ALTER TABLE public.costeo_cargos_fob_agente ADD COLUMN IF NOT EXISTS aplica_iva boolean NOT NULL DEFAULT false;",
  "ALTER TABLE public.costeo_cargos_locales_naviera ADD COLUMN IF NOT EXISTS aplica_iva boolean NOT NULL DEFAULT false;",
];

// The ordinary Drizzle auditor compares functions; this separately pins the DDL.
function assertExactDdl(sql: string) {
  expect(sql.includes(source)).toBe(true);
  expect(sql.match(/ALTER TABLE[^;]+;/g)).toEqual(expected);
  expect(sql).not.toMatch(/\b(?:GRANT|REVOKE|UPDATE|DELETE|INSERT|EXECUTE|CREATE|DROP)\b/);
  expect(sql.match(/\bALTER\b/g)).toHaveLength(2);
  expect(sql.match(/AND a\.attgenerated = ''/g)).toHaveLength(2);
}

describe("0018 cargo IVA exact forward replay", () => {
  it("pins the two immutable historical ALTER statements and their ordinary mapping", () => {
    expect(Buffer.byteLength(source)).toBe(228);
    expect(createHash("sha256").update(source).digest("hex")).toBe(sourceHash);
    expect(source.split("\n")).toEqual(expected);
    const entries = JSON.parse(read("drizzle/replay.json")) as DrizzleReplayEntry[];
    const mapping = entries.filter((entry) => entry.file === sourceFile);
    expect(mapping).toEqual([{ file: sourceFile, sha256: sourceHash, replays: [replayFile] }]);
    expect(scanDrizzleReplay(new Map([[sourceFile, source]]), new Map([[replayFile, replay]]), mapping)).toEqual([]);
    expect(scanFile(replayFile, replay)).toEqual([]);
    assertExactDdl(replay);
  });

  it("rejects changed defaults, extra DDL and direct data or permission mutations", () => {
    expect(() => assertExactDdl(replay.replace("DEFAULT false;", "DEFAULT true;"))).toThrow();
    expect(() => assertExactDdl(replay + "\nALTER TABLE public.costeo_cargos_fob_agente DROP COLUMN monto;")).toThrow();
    expect(() => assertExactDdl(replay + "\nUPDATE public.costeo_cargos_fob_agente SET monto=0;")).toThrow();
    expect(() => assertExactDdl(replay + "\nGRANT ALL ON public.costeo_cargos_fob_agente TO anon;")).toThrow();
  });

  it("requires ordinary columns in both the preflight and postflight", () => {
    assertExactDdl(replay);
    expect(() => assertExactDdl(replay.replace("AND a.attgenerated = ''", ""))).toThrow();
    expect(() => assertExactDdl(replay.replaceAll("AND a.attgenerated = ''", ""))).toThrow();
  });

  it("keeps both generated column contracts aligned with the pinned historical DDL", () => {
    const baseline = read("supabase/schema/baseline.sql");
    for (const table of ["costeo_cargos_fob_agente", "costeo_cargos_locales_naviera"]) {
      const definition = baseline.split(`CREATE TABLE public.${table} (`)[1].split("\n);", 1)[0];
      expect(definition).toContain("aplica_iva boolean DEFAULT false NOT NULL");
    }
  });
});
