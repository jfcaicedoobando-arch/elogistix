import { mkdtempSync, cpSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { HISTORY, listIsolatedHistory, readIsolatedDrizzleReplay } from "../../../scripts/ci/drizzle-history/control.mjs";
import { extraerFunciones } from "../../../scripts/lib/replayMirrorFunctions";
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
      "0026_comisiones_recalcular_al_asignar_vendedora.sql", "0027_clientes_tipo_cliente.sql",
      "0028_pricing_tipo_operacion_sector.sql", "0029_cotizacion_handover.sql",
      "0030_pricing_reglas_plazos.sql", "0031_cotizacion_autorizacion.sql",
      "0032_cliente_especial_sin_autorizacion.sql", "0033_handover_embarque_al_aceptar.sql",
      "0034_prospecto_solo_borrador.sql", "0035_cotizacion_aceptada_hasta_confirmar_embarque.sql", "0036_cotizacion_handover_tenant_scope.sql",
      "0037_cotizacion_especial_trigger_permissions.sql",
      "0038_coordinador_fijo_por_cliente.sql",
      "0039_cotizacion_margen_moneda_homogenea.sql",
    ]);
    expect(readIsolatedDrizzleReplay().size).toBe(17);
    const archive = paths[1].replace("0022_refacturar_proforma_abre_edicion.sql", "meta/_journal.json");
    expect(JSON.parse(read(archive)).entries[22]).toMatchObject({ idx: 22, when: 1792518064767, tag: "0022_refacturar_proforma_abre_edicion" });
    expect(JSON.parse(read("drizzle/migrations/meta/_journal.json")).entries[22].tag).toBe("0022_cotizacion_comercial");
    const historical = read(paths[1]);
    expect(Buffer.byteLength(historical)).toBe(3307);
    const body = historical.split("AS $function$\n")[1].split("$function$;")[0];
    expect(read("supabase/schema/baseline.sql")).toContain(body);
    expect(historical).not.toContain("public.crear_proforma_atomica(");
  });

  it("reconstructs the new sources in journal order without rewriting immutable SQL", () => {
    const current = HISTORY.slice(4);
    const journal = JSON.parse(read("drizzle/migrations/meta/_journal.json"));
    expect(current.map(item => item.file)).toEqual(journal.entries.slice(26, 40).map(
      (entry: { tag: string }) => `${entry.tag}.sql`,
    ));
    for (const item of current) {
      expect(readFileSync(`scripts/ci/drizzle-history/${item.file}`)).toEqual(
        readFileSync(`drizzle/migrations/${item.file}`),
      );
    }
    // Both preparers execute the verified listing, rather than a disconnected map.
    for (const preparer of ["scripts/ci/rls-prepare-db.sh", "scripts/db/local-verify.sh"]) {
      expect(read(preparer)).toContain('node scripts/ci/drizzle-history/control.mjs list');
      expect(read(preparer)).toContain('done <<< "$isolated_history"');
    }
  });

  it("preserves main 0035 and chains the unapplied tenant correction after it", () => {
    const journal = JSON.parse(read("drizzle/migrations/meta/_journal.json")).entries;
    const main = JSON.parse(read("drizzle/migrations/meta/0035_snapshot.json"));
    const tenant = JSON.parse(read("drizzle/migrations/meta/0036_snapshot.json"));
    expect(journal[35]).toEqual({ idx: 35, version: "7", when: 1793990589446,
      tag: "0035_cotizacion_aceptada_hasta_confirmar_embarque", breakpoints: true });
    expect(main.id).toBe("90955556-e21a-46cd-8666-4f951eb6aabb");
    expect(tenant.prevId).toBe(main.id);
    expect(tenant.id).toBe("6f451a18-2f84-43b6-9775-d57c523aae02");
    expect(journal[36].tag).toBe("0036_cotizacion_handover_tenant_scope");
    expect(journal[36].idx).toBe(36);
    expect(journal[36].when).toBeGreaterThan(journal[35].when);
    expect(read("supabase/tests/_guards_manifest.txt").split("\n")).toContain(
      "supabase/tests/cotizacion_aceptada_hasta_confirmar.sql",
    );
  });

  it("chains the unapplied special-quote fix after main 0036 with a strict timestamp", () => {
    const journal = JSON.parse(read("drizzle/migrations/meta/_journal.json")).entries;
    const tenant = JSON.parse(read("drizzle/migrations/meta/0036_snapshot.json"));
    const special = JSON.parse(read("drizzle/migrations/meta/0037_snapshot.json"));
    expect(special.prevId).toBe(tenant.id);
    expect(special.id).not.toBe(tenant.id);
    expect(journal[37]).toEqual({ idx: 37, version: "7", when: 1793990589448,
      tag: "0037_cotizacion_especial_trigger_permissions", breakpoints: true });
    expect(journal[37].when).toBeGreaterThan(journal[36].when);
  });

  it("preserves the upstream coordinator migration before the unapplied margin fix", () => {
    const journal = JSON.parse(read("drizzle/migrations/meta/_journal.json")).entries;
    const special = JSON.parse(read("drizzle/migrations/meta/0037_snapshot.json"));
    const coordinator = JSON.parse(read("drizzle/migrations/meta/0038_snapshot.json"));
    const margin = JSON.parse(read("drizzle/migrations/meta/0039_snapshot.json"));
    expect(coordinator.prevId).toBe(special.id);
    expect(margin.prevId).toBe(coordinator.id);
    expect(margin.id).not.toBe(coordinator.id);
    expect(journal[38]).toEqual({ idx: 38, version: "7", when: 1794002479398,
      tag: "0038_coordinador_fijo_por_cliente", breakpoints: true });
    expect(journal[39]).toEqual({ idx: 39, version: "7", when: 1794002479399,
      tag: "0039_cotizacion_margen_moneda_homogenea", breakpoints: true });
    expect(journal[38].when).toBeGreaterThan(journal[37].when);
    expect(journal[39].when).toBeGreaterThan(journal[38].when);
    expect(read("supabase/tests/_guards_manifest.txt").split("\n")).toContain(
      "supabase/tests/cotizacion_margen_mxn_sin_tc.sql",
    );
  });

  it("matches only the reviewed margin helper in the independently regenerated baseline", () => {
    const source = extraerFunciones(read("drizzle/migrations/0039_cotizacion_margen_moneda_homogenea.sql"));
    const baseline = extraerFunciones(read("supabase/schema/baseline.sql").replaceAll(
      "CREATE FUNCTION public.", "CREATE OR REPLACE FUNCTION public.",
    ));
    expect(source.map(definition => definition.firma)).toEqual(["_cotizacion_margen_pct(uuid)"]);
    // pg_dump quotes the exact GUC identifiers; preserve every other attribute/body byte.
    const dumpedSource = source[0].cuerpo.replace(
      "SET search_path TO pg_catalog, public, pg_temp AS",
      "SET search_path TO 'pg_catalog', 'public', 'pg_temp' AS",
    );
    expect(baseline.find(definition => definition.firma === source[0].firma)?.cuerpo).toBe(dumpedSource);
  });

  it.each(HISTORY.slice(4))("pins source and fixture bytes for $file", item => {
    const root = fixture();
    for (const prefix of ["scripts/ci/drizzle-history", "drizzle/migrations"]) {
      const file = join(root, prefix, item.file);
      writeFileSync(file, read(file) + "\n-- drift");
    }
    expect(() => readIsolatedDrizzleReplay(root)).toThrow(/hash mismatch/);
  });

  it.each(HISTORY.slice(4))("rejects deployment admission and missing fixture for $file", item => {
    const root = fixture();
    const eligible = join(root, "supabase/migrations", "20990101000000_renamed.sql");
    const isolated = join(root, "scripts/ci/drizzle-history", item.file);
    writeFileSync(eligible, read(isolated));
    expect(() => readIsolatedDrizzleReplay(root)).toThrow(/deployment-eligible/);
    rmSync(eligible);
    rmSync(isolated);
    expect(() => readIsolatedDrizzleReplay(root)).toThrow();
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
    const isolatedEntry = entries.find((entry: DrizzleReplayEntry) => entry.file === "0023_margen_minimo_utilidad_rpc.sql");
    expect(isolatedEntry).toBeDefined();
    isolatedEntry.scope = "production";
    writeFileSync(path, JSON.stringify(entries));
    expect(() => readIsolatedDrizzleReplay(root)).toThrow(/mapping mismatch/);
    isolatedEntry.scope = "isolated-ci";
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
