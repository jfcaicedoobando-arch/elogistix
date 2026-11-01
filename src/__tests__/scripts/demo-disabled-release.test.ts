import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractDumpFunction } from "@/test/helpers/extractDumpFunction";
import { scanFile } from "@/../scripts/audit-migrations";
import { buildCatalog, classifyFiles } from "../../../scripts/ci/test-catalog.mjs";

const read = (path: string) => readFileSync(path, "utf8");
const file = "20261015050000_disable_demo_reseed.sql";
const sql = read(`supabase/migrations/${file}`);
const baseline = read("supabase/schema/baseline.sql");
const guard = "  -- Provisional fail-closed stop: conservation/adoption is not verified.\n" +
  "  -- No flag or skip window may enable destructive reseeding in this release.\n" +
  "  RAISE EXCEPTION 'LC_SEED_DEMO_CONSERVACION_PENDIENTE: reseed bloqueado hasta verificar conservación y adopción'\n" +
  "    USING ERRCODE = '55000';\n";
const sources: Record<string, string> = {
  _seed_demo_limpiar_financiero: "20260827224436_426fa39b-ab98-40b6-b31d-89ce1b2b660f.sql",
  seed_demo_organization: "20260827224436_426fa39b-ab98-40b6-b31d-89ce1b2b660f.sql",
  seed_demo_organization_core: "20261014203000_demo_seed_identidad_y_aprobacion.sql",
  seed_demo_organization_guarded: "20261013210000_guard_demo_cleanup_tenant_graph.sql",
};
const normalize = (s: string) => s.split("\n").filter((line) => line.trim()).join("\n") + "\n";

describe("disabled demo release: atomic four-route forward", () => {
  it("passes the unchanged migration scanner with closed, preserved ACL", () => {
    expect(scanFile(file, sql)).toEqual([]);
    expect(sql.match(/^BEGIN;$/gm)).toHaveLength(1);
    expect(sql.match(/^COMMIT;$/gm)).toHaveLength(1);
    expect(sql).not.toMatch(/ALTER (?:ROLE|TABLE)|DISABLE TRIGGER|OWNER TO|INSERT INTO auth\.users|demo_fixture_identity|demo_flow_writer/);
    expect(sql).toContain("(v_after-'prosrc') IS DISTINCT FROM (r.metadata-'prosrc')");
    for (const token of ["p.proowner='postgres'::regrole", "unnest(p.proacl)", "p.proconfig=r.config", "p.prorettype=CASE", "p.proargnames IS NOT DISTINCT FROM", "p.pronargdefaults=CASE"]) expect(sql).toContain(token);
    expect(scanFile(file, sql + "\nGRANT EXECUTE ON FUNCTION public.seed_demo_organization_core() TO PUBLIC;").some((v) => v.check === "H6")).toBe(true);
  });
  it.each(Object.entries(sources))("%s adds only its explicit stop to the exact current body", (name, source) => {
    const before = extractDumpFunction(read(`supabase/migrations/${source}`), `public.${name}`);
    const after = extractDumpFunction(sql, `public.${name}`);
    const canonical = extractDumpFunction(read(`supabase/schema/security/${name}.sql`), `public.${name}`);
    expect(after.body.split(guard)).toHaveLength(2);
    expect(after.body.replace(guard, "")).toBe(before.body);
    expect(canonical).toEqual(after);
    expect(extractDumpFunction(baseline, `public.${name}`).body).toBe(normalize(after.body));
    for (const body of [before.body, after.body]) {
      expect(sql).toContain(createHash("sha256").update("\n" + body).digest("hex"));
    }
    const stop = after.body.indexOf(guard);
    const nextWork = after.body.slice(stop + guard.length).search(/PERFORM|LOCK TABLE|DELETE FROM|UPDATE public\.|INSERT INTO public\.|RETURN false/);
    expect(nextWork).toBeGreaterThanOrEqual(0);
    expect(after.body.slice(0, stop)).not.toMatch(/DELETE FROM|UPDATE public\.|INSERT INTO public\.|set_config|pg_advisory_xact_lock/);
  });
  it("retains earlier authorization and blocks before cooldown / session flags", () => {
    const core = extractDumpFunction(sql, "public.seed_demo_organization_core").body;
    expect(core.indexOf("IF auth.uid() IS NULL")).toBeLessThan(core.indexOf(guard));
    for (const name of ["seed_demo_organization", "seed_demo_organization_guarded"]) {
      const body = extractDumpFunction(sql, `public.${name}`).body;
      expect(body.indexOf("LC_SEED_DEMO_NO_AUTORIZADO")).toBeLessThan(body.indexOf(guard));
    }
    expect(extractDumpFunction(sql, "public.seed_demo_organization_guarded").body.indexOf(guard))
      .toBeLessThan(extractDumpFunction(sql, "public.seed_demo_organization_guarded").body.indexOf("RETURN false"));
  });
  it("prepares real rollback-only SQL tests without replacing protected functions", () => {
    const suite = read("supabase/tests/rls/test_rls_demo_seed_disabled.sql");
    expect(suite).toContain("count(*)=45");
    expect(suite).toContain("attempted DML despite eventual rollback");
    expect(suite).toContain("full public/auth/registry rows or sequences changed");
    expect(suite).not.toMatch(/CREATE OR REPLACE FUNCTION public\.|DISABLE TRIGGER|COMMIT;/);
  });
});

it("canonical adapter validation uses fresh Deno 2.9.8 and original imports without suppression", () => {
  const workflow = read(".github/workflows/demo-disabled-validation.yml");
  expect(workflow).toContain("deno-version: v2.9.8");
  expect(workflow).toContain("deno cache --node-modules-dir=none supabase/functions/demo-access/index.ts");
  expect(workflow).toContain("deno check --node-modules-dir=none supabase/functions/demo-access/index.ts");
  expect(workflow).not.toMatch(/--no-check|--unsafely-ignore-certificate|--import-map|ts-ignore|noCheck/);
  expect(read("supabase/functions/demo-access/index.ts")).not.toContain("availabilityProvider:");
});

it("routes only the approved offline smoke file to its automatic Node lane", () => {
  const catalog = buildCatalog();
  expect(catalog.entries.filter((entry) => entry.lane === "node-post-deploy-smoke"))
    .toEqual([expect.objectContaining({ path: "scripts/ci/post-deploy-smoke.test.mjs", mode: "automatic" })]);
  const files = catalog.entries.map((entry) => entry.path);
  const guards = catalog.entries.filter((entry) => entry.lane === "sql-guards").map((entry) => entry.path);
  const support = Object.fromEntries(catalog.entries.filter((entry) => entry.lane === "sql-support").map((entry) => [entry.path, entry.reason]));
  expect(() => classifyFiles([...files, "scripts/ci/other-smoke.test.mjs"], guards, support)).toThrow(/no execution lane/);
});

it("runs the offline smoke contract unconditionally in ordinary CI after discovery", () => {
  const ci = read(".github/workflows/ci.yml");
  const detector = ci.split("  detector:")[1].split("\n  lint:")[0];
  const step = detector.split("      - name: Post-deploy smoke contract (offline, no credentials)\n")[1].split(/\n\s+- name:/)[0];
  expect(step).toContain("run: node --test scripts/ci/post-deploy-smoke.test.mjs");
  expect(step).not.toMatch(/\bif:|continue-on-error|secrets\.|--allow-net/);
  expect(detector.indexOf("--output reports/test-inventory.json"))
    .toBeLessThan(detector.indexOf("node --test scripts/ci/post-deploy-smoke.test.mjs"));
});
