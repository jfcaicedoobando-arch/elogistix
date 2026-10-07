import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extraerFunciones } from "../../../scripts/lib/replayMirrorFunctions";

const oldName = "20261006230000_proforma_operativa_consistencia.sql";
const nextName = "20261006233000_proforma_operativa_compatibilidad.sql";
const archivePath = `supabase/migrations_archive/withdrawn-unapplied/${oldName}`;
const replacementPath = `supabase/migrations/${nextName}`;
const oldHash = "b9956cf2e36a8a8165d94b1cadab749008dabd11c01186ebfa304bb2b6ad4721";
const nextHash = "a889d1dc97b385c89dff49820bc8b2e6f04f324760dc3d850c11c442008d5797";
const list35Hash = "9093b16b0d580397dea91ec6757036633e89beebfd1d5d660fcb3f97d7d5f650";
const read = (path: string) => readFileSync(path, "utf8");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const original = read(archivePath);
const replacement = read(replacementPath);

describe("unapplied managed-proforma migration retirement", () => {
  it("preserves the exact withdrawn source outside the executable migration directory", () => {
    expect(hash(original)).toBe(oldHash);
    expect(existsSync(`supabase/migrations/${oldName}`)).toBe(false);
    expect(readdirSync("supabase/migrations_archive/withdrawn-unapplied")).toEqual([oldName]);
  });
  it("pins the complete reviewed replacement and its explicit provenance record", () => {
    expect(hash(replacement)).toBe(nextHash);
    const registry = JSON.parse(read("supabase/releases/withdrawn-unapplied.json"));
    expect(registry).toHaveLength(1);
    expect(registry[0]).toMatchObject({
      originalPath: `supabase/migrations/${oldName}`, archivePath, originalSha256: oldHash,
      replacementPath, replacementSha256: nextHash, status: "withdrawn-unapplied",
      historicalRelease: "13.824.35", historicalMigrationListSha256: list35Hash,
    });
  });
  it("changes only the two scoped runtime functions among nine existing signatures", () => {
    const before = extraerFunciones(original);
    const after = extraerFunciones(replacement);
    expect(before).toHaveLength(9);
    expect(after.map((fn) => fn.firma)).toEqual(before.map((fn) => fn.firma));
    expect(after.filter((fn, index) => fn.cuerpo !== before[index].cuerpo).map((fn) => fn.nombre))
      .toEqual(["recompute_embarque_tiene_proforma", "sync_conceptos_venta_facturado"]);
    expect(replacement).not.toContain('SET "app.bypass_cierre"');
  });
  it("preserves every trigger and explicit privilege statement byte for byte", () => {
    const marker = "DROP TRIGGER IF EXISTS trg_sync_embarque_tiene_proforma_from_concepto";
    expect(replacement.slice(replacement.indexOf(marker))).toBe(original.slice(original.indexOf(marker)));
  });
  it("retains a mandatory byte-exact historical manifest after rolling-window pruning", () => {
    const historicalPath = "supabase/releases/history/13.824.35-migration-manifest.json";
    const archived = read(historicalPath);
    expect(hash(archived)).toBe("86f1e05008e9e938b9500fc1a8c29743dd1bfdc2fabd78b3abbdd1456695ef16");
    expect(hash(`${JSON.parse(archived)["13.824.35"].migrations.join("\n")}\n`)).toBe(list35Hash);
    const current = JSON.parse(read("supabase/releases/migration-manifest.json"));
    const retained: { migrations: string[] } | undefined = current["13.824.35"];
    expect(retained ? hash(`${retained.migrations.join("\n")}\n`) : list35Hash).toBe(list35Hash);
  });
  it("pins target-bounded rollback evidence without claiming another target is unapplied", () => {
    const path = "supabase/migrations_archive/evidence/proforma2300-rollback-20261007.json";
    const evidence = read(path);
    expect(hash(evidence)).toBe("f552a5afca26a130f9c34b7435ca86250def02c14c8955a92a288a650ca5ec31");
    expect(JSON.parse(evidence).target).toEqual({
      lovableProjectId: "341dfc00-0308-4aba-9246-e4b2041e31f1",
      supabaseProjectRef: "eorqadkulqtneqjbsblk",
    });
    expect(JSON.parse(evidence).unappliedVersions).toEqual(["20261006225000", "20261006230000"]);
  });
});
