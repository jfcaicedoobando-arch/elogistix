import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scanFile } from "@/../scripts/audit-migrations";
import { indexReplayRepairs, functionReplayRepairs, isFunctionReplayRepair } from "@/../scripts/lib/audit-hygiene-replay";

const oldFile = "20261002000000_original.sql";
const newFile = "20261003011000_replay.sql";
const index = "CREATE INDEX ix ON public.crm_valores(organization_id, propiedad_id) WHERE activa;";
const replay = index.replace("INDEX ix", "INDEX IF NOT EXISTS ix");
const fn = `CREATE OR REPLACE FUNCTION public.fixture(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RETURN jsonb_build_object('estado', 'ACTIVO'); END $$;`;
const acl = "REVOKE ALL ON FUNCTION public.fixture(uuid) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.fixture(uuid) TO authenticated;";

describe("higiene de migraciones aplicadas: reparación explícita, no excepciones", () => {
  it("no acepta un índice sin IF NOT EXISTS por sí solo", () => {
    expect(scanFile(oldFile, index).filter((v) => v.check === "H4")).toHaveLength(1);
  });
  it("acepta únicamente una reemisión idéntica posterior", () => {
    const repairs = indexReplayRepairs(new Map([[newFile, replay]]));
    expect(scanFile(oldFile, index, true, repairs)).toEqual([]);
    expect(scanFile(newFile, index, true, repairs).filter((v) => v.check === "H4")).toHaveLength(1);
  });
  it.each([
    replay.replace("ix", "other_ix"), replay.replace("crm_valores", "otra_tabla"),
    replay.replace("propiedad_id", "registro_id"), replay.replace("WHERE activa", "WHERE NOT activa"),
    replay.replace("CREATE INDEX", "CREATE UNIQUE INDEX"), "-- " + replay,
  ])("no oculta deuda con un índice diferente o comentado (%s)", (different) => {
    const repairs = indexReplayRepairs(new Map([[newFile, different]]));
    expect(scanFile(oldFile, index, true, repairs).filter((v) => v.check === "H4")).toHaveLength(1);
  });
  it("exige el mismo statement completo y una ACL válida posterior para cerrar H6", () => {
    const failures = scanFile(oldFile, fn).filter((v) => v.check === "H6");
    const repairs = functionReplayRepairs(new Map([[newFile, fn + acl]]));
    expect(failures).toHaveLength(2);
    expect(failures.every((v) => isFunctionReplayRepair(oldFile, fn, v, repairs))).toBe(true);
    expect(failures.some((v) => isFunctionReplayRepair(newFile, fn, v, repairs))).toBe(false);
  });
  it.each([fn, fn + acl.replace(" FROM PUBLIC, anon", " FROM anon"), fn.replace("ACTIVO", "activo") + acl])(
    "no cierra H6 con cuerpo distinto o permisos incompletos", (sql) => {
      const repairs = functionReplayRepairs(new Map([[newFile, sql]]));
      expect(scanFile(oldFile, fn).some((v) => isFunctionReplayRepair(oldFile, fn, v, repairs))).toBe(false);
    });
  it("nunca perdona GRANT EXECUTE TO PUBLIC", () => {
    const bad = fn + acl + " GRANT EXECUTE ON FUNCTION public.fixture(uuid) TO PUBLIC;";
    const repairs = functionReplayRepairs(new Map([[newFile, fn + acl]]));
    const failure = scanFile(oldFile, bad).find((v) => v.detail.includes("TO PUBLIC (prohibido)"))!;
    expect(isFunctionReplayRepair(oldFile, bad, failure, repairs)).toBe(false);
  });
  it("el replay CRM conserva exactamente la definición vigente de la RPC", () => {
    const read = (f: string) => readFileSync(resolve(process.cwd(), "supabase/migrations", f), "utf8");
    const source = read("20261002000512_267ce501-c65a-4364-bf1d-e2b1a4e0e132.sql");
    const corrected = read("20261003011000_crm_hygiene_replay.sql");
    const repairs = functionReplayRepairs(new Map([[newFile, corrected]]));
    const failures = scanFile(oldFile, source);
    expect(failures).toHaveLength(2);
    expect(failures.every((v) => isFunctionReplayRepair(oldFile, source, v, repairs))).toBe(true);
    expect(scanFile(newFile, corrected)).toEqual([]);
  });
});
