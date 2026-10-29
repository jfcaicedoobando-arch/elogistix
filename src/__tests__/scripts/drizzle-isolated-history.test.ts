import { mkdtempSync, cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { HISTORY, listIsolatedHistory, readIsolatedDrizzleReplay } from "../../../scripts/ci/drizzle-history/control.mjs";
import { scanDrizzleReplay, type DrizzleReplayEntry } from "../../../scripts/lib/audit-drizzle-replay";

const roots: string[] = [];
const read = (file: string) => readFileSync(file, "utf8");
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "drizzle-isolated-"));
  roots.push(root);
  for (const dir of ["scripts/ci/drizzle-history", "drizzle/migrations", "supabase/migrations"]) {
    mkdirSync(join(root, dir), { recursive: true });
  }
  cpSync("scripts/ci/drizzle-history", join(root, "scripts/ci/drizzle-history"), { recursive: true });
  cpSync("drizzle/replay.json", join(root, "drizzle/replay.json"));
  for (const item of HISTORY.filter(item => item.eligibleName)) {
    cpSync(`drizzle/migrations/${item.file}`, join(root, "drizzle/migrations", item.file));
  }
  return root;
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe("isolated Drizzle history is not deployment-eligible", () => {
  it("verifies immutable order, archived collision provenance and the effective body", () => {
    const paths = listIsolatedHistory();
    expect(paths.map(path => path.split("/").at(-1))).toEqual([
      "0021_refacturar_proforma_rpc.sql", "0022_refacturar_proforma_abre_edicion.sql",
      "0022_cotizacion_comercial.sql", "0023_margen_minimo_utilidad_rpc.sql",
    ]);
    expect(readIsolatedDrizzleReplay().size).toBe(3);
    const archive = paths[1].replace("0022_refacturar_proforma_abre_edicion.sql", "meta/_journal.json");
    expect(JSON.parse(read(archive)).entries[22]).toMatchObject({ idx: 22, when: 1792518064767, tag: "0022_refacturar_proforma_abre_edicion" });
    expect(JSON.parse(read("drizzle/migrations/meta/_journal.json")).entries[22].tag).toBe("0022_cotizacion_comercial");
    const historical = read(paths[1]);
    expect(Buffer.byteLength(historical)).toBe(3307);
    const body = historical.split("AS $function$\n")[1].split("$function$;")[0];
    expect(read("supabase/schema/baseline.sql")).toContain(body);
    expect(historical).not.toContain("public.crear_proforma_atomica(");
  });

  it("fails closed if a fixture or its source changes, even together", () => {
    const root = fixture();
    const item = HISTORY[0];
    for (const prefix of ["scripts/ci/drizzle-history", "drizzle/migrations"]) {
      const file = join(root, prefix, item.file);
      writeFileSync(file, read(file) + "\n-- drift");
    }
    expect(() => readIsolatedDrizzleReplay(root)).toThrow(/hash mismatch/);
  });

  it("rejects missing recovered history and deployable copies", () => {
    const root = fixture();
    writeFileSync(join(root, "supabase/migrations", HISTORY[0].eligibleName!), read(join(root, "scripts/ci/drizzle-history", HISTORY[0].file)));
    expect(() => readIsolatedDrizzleReplay(root)).toThrow(/deployment-eligible/);
    rmSync(join(root, "supabase/migrations", HISTORY[0].eligibleName!));
    rmSync(join(root, "scripts/ci/drizzle-history", HISTORY[1].file));
    expect(() => readIsolatedDrizzleReplay(root)).toThrow();
  });

  it("rejects renamed deployment copies, including recovered history", () => {
    const root = fixture();
    writeFileSync(join(root, "supabase/migrations", "20990101000000_renamed.sql"), read(join(root, "scripts/ci/drizzle-history", HISTORY[1].file)));
    expect(() => readIsolatedDrizzleReplay(root)).toThrow(/deployment-eligible/);
  });

  it("requires explicit isolated scope and rejects extra isolated admissions", () => {
    const root = fixture();
    const path = join(root, "drizzle/replay.json");
    const entries = JSON.parse(read(path));
    entries.at(-1).scope = "production";
    writeFileSync(path, JSON.stringify(entries));
    expect(() => readIsolatedDrizzleReplay(root)).toThrow(/mapping mismatch/);
    entries.at(-1).scope = "isolated-ci";
    entries.push({ file: "unreviewed.sql", scope: "isolated-ci", replays: [] });
    writeFileSync(path, JSON.stringify(entries));
    expect(() => readIsolatedDrizzleReplay(root)).toThrow(/Unreviewed/);
  });

  it("cannot satisfy isolated reconstruction with the canonical map or no verified map", () => {
    const entries = (JSON.parse(read("drizzle/replay.json")) as DrizzleReplayEntry[]).filter(entry => entry.scope === "isolated-ci");
    const isolated = readIsolatedDrizzleReplay();
    expect(scanDrizzleReplay(isolated, new Map(), entries, isolated)).toEqual([]);
    expect(scanDrizzleReplay(isolated, isolated, entries).map(v => v.check)).toContain("DR7");
    const changed = new Map(isolated);
    changed.set(HISTORY[0].file, changed.get(HISTORY[0].file)! + "\n");
    expect(scanDrizzleReplay(isolated, new Map(), entries, changed).map(v => v.check)).toContain("DR7");
  });
});
