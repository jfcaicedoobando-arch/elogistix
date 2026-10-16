import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scanFile } from "@/../scripts/audit-migrations";
import { scanDrizzleReplay, type DrizzleReplayEntry } from "@/../scripts/lib/audit-drizzle-replay";

const read = (path: string) => readFileSync(path, "utf8");
const hash = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const historical = [
  { index: 16, file: "0016_crm_empresa_desde_cliente.sql", bytes: 1407, sha256: "9a1092ca7e9a59a2166140c19a182f05c562284e10db489e998cdb098d14a629", snapshot: "935fffab7106e8c810ea8a7224a3c78e19cba3a996b60d0aa8e64a07365b816f", replay: "20261014202800_replay_crm_empresa_desde_cliente.sql", mirror: "crm_empresa_desde_cliente.sql" },
  { index: 17, file: "0017_crm_empresa_no_borrar_cliente.sql", bytes: 1483, sha256: "548be2b88fde30174ce4b90fdc333cd6f745f0948bf331907de879ee5c95bcdb", snapshot: "23808e539988e4e6b1ecc7332728645b9bba00cdafcca4e8b23ae43ca88863b4", replay: "20261014202900_replay_crm_empresa_no_borrar_cliente.sql", mirror: "crm_empresa_no_borrar_cliente.sql" },
  { index: 18, file: "0018_cargos_tarifario_aplica_iva.sql", bytes: 228, sha256: "e54c5f4dce851c8d30d3c71336c315ae7b600c72a5a5cc1d5194b908cbbbadee", snapshot: "ae128768aeed658c28c9478f515ddeebb9d7cdefc83cd4778ad9de225d58899c", replay: "20261014203100_replay_cargos_tarifario_aplica_iva.sql" },
] as const;
type Journal = { entries: { idx: number; tag: string; when: number; version: string }[] };
type Snapshot = { id: string; prevId: string; dialect: string; version: string };
const journal: Journal = JSON.parse(read("drizzle/migrations/meta/_journal.json"));
const snapshots = journal.entries.map(({ idx }) => JSON.parse(read(`drizzle/migrations/meta/${String(idx).padStart(4, "0")}_snapshot.json`)) as Snapshot);

function assertChain(entries: Journal["entries"], chain: Snapshot[]) {
  expect(entries.length).toBeGreaterThanOrEqual(19);
  expect(hash(JSON.stringify(entries.slice(0, 19)))).toBe("bbaaeda46d650f705537ed6712510d8ac1293f6e019fbfc71d0c3eba1f63ce12");
  expect(new Set(entries.map(({ tag }) => tag)).size).toBe(entries.length);
  for (const [index, entry] of entries.entries()) {
    expect(entry.idx).toBe(index);
    expect(existsSync(`drizzle/migrations/${entry.tag}.sql`)).toBe(true);
    expect(chain[index].dialect).toBe("postgresql");
    expect(chain[index].version).toBe(entry.version);
    if (index > 0) {
      expect(chain[index].prevId).toBe(chain[index - 1].id);
      expect(entry.when).toBeGreaterThan(entries[index - 1].when);
    }
  }
}

describe("immutable CRM 0016 -> 0017 -> cargo 0018 replay chain", () => {
  it("pins the published SQL and snapshot bytes", () => {
    for (const item of historical) {
      const source = readFileSync(`drizzle/migrations/${item.file}`);
      expect(source.length).toBe(item.bytes);
      expect(hash(source)).toBe(item.sha256);
      expect(hash(readFileSync(`drizzle/migrations/meta/${String(item.index).padStart(4, "0")}_snapshot.json`))).toBe(item.snapshot);
    }
  });

  it("keeps historical CRM replays literal and current mirrors in the explicit forward", () => {
    const mapping = JSON.parse(read("drizzle/replay.json")) as DrizzleReplayEntry[];
    const forwardName = "20261016070000_crm_cliente_identidad_atomica.sql";
    const forward = read(`supabase/migrations/${forwardName}`);
    expect(scanFile(forwardName, forward)).toEqual([]);
    for (const item of historical) {
      expect(mapping.filter(({ file }) => file === item.file)).toEqual([{ file: item.file, sha256: item.sha256, replays: [item.replay] }]);
      expect(scanFile(item.replay, read(`supabase/migrations/${item.replay}`))).toEqual([]);
      if ("mirror" in item) {
        const source = readFileSync(`drizzle/migrations/${item.file}`);
        expect(readFileSync(`supabase/migrations/${item.replay}`)).toEqual(source);
        // Historical replay bytes stay pinned above; canonical mirrors evolve
        // only through a complete, separately reviewed forward definition.
        expect(forward).toContain(read(`supabase/schema/crm/${item.mirror}`));
      }
    }
    expect(read("supabase/tests/rls/_ci_service_role_only.sql")).toContain("('public._crm_empresa_desde_cliente()')");
  });

  it("passes the actual all-source replay scanner", () => {
    const files = (directory: string) => new Map(readdirSync(directory).filter((file) => file.endsWith(".sql")).map((file) => [file, read(`${directory}/${file}`)]));
    expect(scanDrizzleReplay(files("drizzle/migrations"), files("supabase/migrations"), JSON.parse(read("drizzle/replay.json")))).toEqual([]);
  });

  it("preserves the historical journal prefix and connects every current snapshot", () => {
    assertChain(journal.entries, snapshots);
  });

  it("rejects a missing historical entry or broken predecessor", () => {
    const missing = structuredClone(journal.entries);
    missing.splice(16, 1);
    expect(() => assertChain(missing, snapshots)).toThrow();
    const broken = structuredClone(snapshots);
    broken[18].prevId = snapshots[15].id;
    expect(() => assertChain(journal.entries, broken)).toThrow();
  });
});

