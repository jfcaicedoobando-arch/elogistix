// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readIsolatedDrizzleReplay } from "../../../scripts/ci/drizzle-history/control.mjs";
import { aplicarDrizzle0057, PATCH_0057 } from "../../../scripts/lib/replayMirrorDrizzle0057";
import { auditarIndiceReplayMirror, huellaDefinicion, indexarMigraciones } from "../../../scripts/lib/replayMirror";

const signature = "crm_vincular_cotizacion_cliente_pricing(uuid,uuid,uuid,uuid)";
const read = (file: string) => readFileSync(file, "utf8");
const sources = readIsolatedDrizzleReplay();
const historical = indexarMigraciones(new Map(readdirSync("supabase/migrations").filter(file => file.endsWith(".sql"))
  .map(file => [file, read(`supabase/migrations/${file}`)])));
const mirrorFile = "supabase/schema/crm/crm_vincular_cotizacion_cliente_pricing.sql";
const mirrors = new Map([[mirrorFile, read(mirrorFile)]]);

describe("bounded Drizzle0057 policy fingerprint model", () => {
  it("derives the current mirror from pinned history and preserves every other signature", () => {
    const previous = historical.get(signature)!;
    const result = aplicarDrizzle0057(historical, sources);
    expect(auditarIndiceReplayMirror(mirrors, result, []).violaciones).toEqual([]);
    expect(huellaDefinicion(previous.definicion)).toBe("070b4b15ba2c8951b6dff97e6fa8eeb2b489a2230a8a8130bc6f103a1641de1d");
    expect(result.get(signature)?.migracion).toBe(`drizzle/migrations/${PATCH_0057}`);
    expect(result.size).toBe(historical.size);
    for (const [key, entry] of historical) {
      if (key !== signature) expect(result.get(key)).toBe(entry);
    }
    const before: string[] = JSON.parse(previous.definicion.cuerpo);
    const after: string[] = JSON.parse(result.get(signature)!.definicion.cuerpo);
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[2]);
    const beforeLiteral = before[1].split("$policies$");
    const afterLiteral = after[1].split("$policies$");
    expect(afterLiteral[0]).toBe(beforeLiteral[0]);
    expect(afterLiteral[2]).toBe(beforeLiteral[2]);
    expect(afterLiteral[1]).toContain("(created_by = ( SELECT auth.uid() AS uid))");
  });

  it.each(["missing", "changed"])("rejects %s patch source", mode => {
    const changed = new Map(sources);
    if (mode === "missing") changed.delete(PATCH_0057);
    else changed.set(PATCH_0057, sources.get(PATCH_0057)! + "\n-- drift");
    expect(() => aplicarDrizzle0057(historical, changed)).toThrow(/patch source/);
  });

  it.each(["missing", "body", "literal", "migration", "already-applied"])("rejects %s preimage instead of deriving from the mirror", mode => {
    const changed = new Map(historical);
    const previous = historical.get(signature)!;
    if (mode === "missing") changed.delete(signature);
    else if (mode === "migration") changed.set(signature, { ...previous, migracion: "20990101000000_other.sql" });
    else if (mode === "already-applied") changed.set(signature, aplicarDrizzle0057(historical, sources).get(signature)!);
    else changed.set(signature, { ...previous, definicion: { ...previous.definicion, cuerpo: mode === "literal"
      ? previous.definicion.cuerpo.replace("(created_by = auth.uid())", "(true)")
      : previous.definicion.cuerpo + " " } });
    expect(() => aplicarDrizzle0057(changed, sources)).toThrow(/preimage/);
  });

  it("does not report a stale or predicate-mutated CRM mirror as current", () => {
    const result = aplicarDrizzle0057(historical, sources);
    for (const sql of [read(mirrorFile).replace("(created_by = ( SELECT auth.uid() AS uid))", "(created_by = auth.uid())"),
      read(mirrorFile).replace("(created_by = ( SELECT auth.uid() AS uid))", "(true)")]) {
      expect(auditarIndiceReplayMirror(new Map([[mirrorFile, sql]]), result, []).violaciones).toHaveLength(1);
    }
  });
});
