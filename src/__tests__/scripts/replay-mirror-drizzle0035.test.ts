// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readIsolatedDrizzleReplay } from "../../../scripts/ci/drizzle-history/control.mjs";
import { aplicarDrizzle0035, PATCH_0035 } from "../../../scripts/lib/replayMirrorDrizzle0035";
import { auditarIndiceReplayMirror, indexarMigraciones } from "../../../scripts/lib/replayMirror";
import { extraerFunciones } from "../../../scripts/lib/replayMirrorFunctions";

const read = (file: string) => readFileSync(file, "utf8");
const sources = readIsolatedDrizzleReplay();
const journal = JSON.parse(read("drizzle/migrations/meta/_journal.json")).entries;
const migrations = new Map(readdirSync("supabase/migrations").filter(file => file.endsWith(".sql"))
  .map(file => [file, read(`supabase/migrations/${file}`)]));
const historical = indexarMigraciones(migrations);
const mirrors = new Map(["crear_embarque_borrador_core", "sync_cotizacion_embarque_link"]
  .map(name => [`supabase/schema/embarques/${name}.sql`, read(`supabase/schema/embarques/${name}.sql`)]));

describe("bounded Drizzle0035 dynamic replay model", () => {
  it("derives both mirrors from immutable preimages without changing the input index", () => {
    const result = aplicarDrizzle0035(historical, sources, journal);
    expect(auditarIndiceReplayMirror(mirrors, result, []).violaciones).toEqual([]);
    expect(historical.get("crear_embarque_borrador_core(uuid)")!.migracion).toBe("20261012224500_fix_conversion_puertos_uuid.sql");
    expect(result.size).toBe(historical.size);
    const targets = new Set(["crear_embarque_borrador_core(uuid)", "sync_cotizacion_embarque_link()"]);
    for (const [signature, definition] of historical) {
      if (!targets.has(signature)) expect(result.get(signature)).toBe(definition);
    }
  });

  it("matches both definitions in the independently regenerated PostgreSQL baseline", () => {
    const dump = extraerFunciones(read("supabase/schema/baseline.sql").replaceAll("CREATE FUNCTION public.", "CREATE OR REPLACE FUNCTION public."));
    const result = aplicarDrizzle0035(historical, sources, journal);
    for (const signature of ["crear_embarque_borrador_core(uuid)", "sync_cotizacion_embarque_link()"]) {
      expect(dump.find(definition => definition.firma === signature)?.cuerpo).toBe(result.get(signature)!.definicion.cuerpo);
    }
  });

  it.each(["missing", "tampered"])("rejects %s source", mode => {
    const changed = new Map(sources);
    if (mode === "missing") changed.delete(PATCH_0035);
    else changed.set(PATCH_0035, sources.get(PATCH_0035)! + "\n-- drift");
    expect(() => aplicarDrizzle0035(historical, changed, journal)).toThrow(/patch source/);
  });

  it.each(["crear_embarque_borrador_core(uuid)", "sync_cotizacion_embarque_link()"])("rejects altered preimage and later definition for %s", signature => {
    const changed = new Map(historical);
    const previous = historical.get(signature)!;
    changed.set(signature, { ...previous, definicion: { ...previous.definicion, cuerpo: previous.definicion.cuerpo + " " } });
    expect(() => aplicarDrizzle0035(changed, sources, journal)).toThrow(/preimage/);
    changed.set(signature, { ...previous, migracion: "20990101000000_new_definition.sql" });
    expect(() => aplicarDrizzle0035(changed, sources, journal)).toThrow(/preimage/);
    changed.delete(signature);
    expect(() => aplicarDrizzle0035(changed, sources, journal)).toThrow(/preimage/);
  });

  it("rejects unsupported journal order, timestamps, additions and source order", () => {
    for (const changed of [journal.slice(0, 40), [...journal, { idx: 42, tag: "0042_new", when: journal[41].when + 1 }],
      journal.map((entry: object, idx: number) => idx === 39 ? { ...entry, when: journal[38].when } : entry),
      journal.map((entry: object, idx: number) => idx === 39 ? { ...entry, tag: "0039_other" } : entry),
      journal.map((entry: object, idx: number) => idx === 38 ? { ...entry, when: journal[37].when } : entry),
      journal.map((entry: object, idx: number) => idx === 38 ? { ...entry, tag: "0038_other" } : entry),
      journal.map((entry: object, idx: number) => idx === 37 ? { ...entry, when: journal[36].when } : entry),
      journal.map((entry: object, idx: number) => idx === 37 ? { ...entry, tag: "0037_other" } : entry),
      journal.map((entry: object, idx: number) => idx === 36 ? { ...entry, when: journal[35].when } : entry),
      journal.map((entry: object, idx: number) => idx === 35 ? { ...entry, tag: "0035_other" } : entry)]) {
      expect(() => aplicarDrizzle0035(historical, sources, changed)).toThrow(/order/);
    }
    expect(() => aplicarDrizzle0035(historical, new Map([...sources].reverse()), journal)).toThrow(/order/);
  });

  it.each(["0037_cotizacion_especial_trigger_permissions.sql", "0038_coordinador_fijo_por_cliente.sql", "0039_cotizacion_margen_moneda_homogenea.sql", "0040_coordinador_permission_boundary.sql", "0041_prospecto_housekeeping_historicos.sql"])("rejects unreviewed later source %s even when the earlier patch is intact", key => {
    const changed = new Map(sources);
    changed.set(key, sources.get(key)! + "\nCREATE OR REPLACE FUNCTION public.sync_cotizacion_embarque_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;");
    expect(() => aplicarDrizzle0035(historical, changed, journal)).toThrow(/later source/);
  });

  it("still rejects altered output instead of accepting a matching exception", () => {
    const changed = new Map([...mirrors].map(([file, sql]) => [file, sql.replace("RETURN NEW;", "RETURN NULL;").replace("RETURN v_embarque_id;", "RETURN NULL;")]));
    expect(auditarIndiceReplayMirror(changed, aplicarDrizzle0035(historical, sources, journal), []).violaciones).toHaveLength(2);
  });

  it("requires the missing canonical terminator rather than weakening the parser", () => {
    const sql = mirrors.get("supabase/schema/embarques/sync_cotizacion_embarque_link.sql")!;
    expect(extraerFunciones(sql)).toHaveLength(1);
    expect(() => extraerFunciones(sql.replace(/\$function\$;\s*$/, "$function$"))).toThrow(/sin terminador/);
  });
});
