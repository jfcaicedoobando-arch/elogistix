// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { scanSecurityDefinerWithPreservedAcl } from "../lib/audit-acl-preservation";

const file = "20261013141500_factura_eliminada_guard_hijos.sql";
const migration = readFileSync(resolve("supabase/migrations", file), "utf8");
const squash = readFileSync(resolve("supabase/schema/squash/baseline_squash_v13_821_0.sql"), "utf8");
const profiles = [
  { name: "assert_factura_viva_para_rep", source: "20260718213500_db6fd761-d398-471d-93d3-cd6c71e1143e.sql",
    sourceMd5: "10621bffc7289d11acf116b24f9fe966", squashMd5: "40badfd37ee72215f3b81c21c3f0bc50", emptyLines: 4 },
  { name: "duplicar_factura_para_sustitucion", source: "20260717000021_1892efbe-7933-428a-aec9-54371844d0c3.sql",
    sourceMd5: "51cd445e39365a256a4864cf1d871cb3", squashMd5: "e0b8bdc97556afd0cba54c11104eebfb", emptyLines: 12 },
] as const;
function prosrc(sql: string, name: string) {
  const match = sql.match(new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\([\\s\\S]*?AS (\\$\\w*\\$)([\\s\\S]*?)\\1;`, "i"));
  if (!match) throw new Error(`Missing function ${name}`);
  return match[2];
}
const md5 = (value: string) => createHash("md5").update(value, "utf8").digest("hex");

describe("exact source and squash parent-guard profiles", () => {
  for (const profile of profiles) {
    it(`${profile.name}: only the known empty separator lines differ`, () => {
      const source = prosrc(readFileSync(resolve("supabase/migrations", profile.source), "utf8"), profile.name);
      const compact = prosrc(squash, profile.name);
      expect(md5(source)).toBe(profile.sourceMd5);
      expect(md5(compact)).toBe(profile.squashMd5);
      // Evidence only, NEVER runtime admission normalization. Ordered comparison
      // permits deleting an empty line only; preserves all other bytes/lines.
      const from = source.split("\n");
      const to = compact.split("\n");
      let j = 0;
      let removed = 0;
      for (const line of from) {
        if (line === to[j]) j += 1;
        else { expect(line).toBe(""); removed += 1; }
      }
      expect(j).toBe(to.length);
      expect(removed).toBe(profile.emptyLines);
      const targetMd5 = md5(prosrc(migration, profile.name));
      expect(migration).toContain(`ARRAY['${profile.sourceMd5}','${profile.squashMd5}','${targetMd5}']::text[]`);
    });
    it(`${profile.name}: changing either admitted original/squash hash restores H6`, () => {
      for (const hash of [profile.sourceMd5, profile.squashMd5]) {
        const changed = migration.replace(hash, "00000000000000000000000000000000");
        expect(scanSecurityDefinerWithPreservedAcl(file, changed, true)).toHaveLength(4);
      }
    });
  }
  it("keeps exact matching, original NC preimage and metadata checks", () => {
    const ncSource = readFileSync(resolve("supabase/migrations/20261008143000_replay_audit144_nc_identidad.sql"), "utf8");
    const original = md5(prosrc(ncSource, "_nc_validar_linaje_conceptos"));
    const target = md5(prosrc(migration, "_nc_validar_linaje_conceptos"));
    expect(migration).toContain(`ARRAY['${original}','${target}']::text[]`);
    expect(migration).toContain("md5(p.prosrc) = ANY(expected.body_hashes)");
    expect(migration).toContain("p.proacl IS DISTINCT FROM b.proacl");
    expect(migration).toContain("p.proowner IS DISTINCT FROM b.proowner");
    const admission = migration.split("$preconditions$;")[0];
    expect(admission).not.toMatch(/regexp_replace|trim\(|replace\(p\.prosrc|EXECUTE\s/i);
  });
});
