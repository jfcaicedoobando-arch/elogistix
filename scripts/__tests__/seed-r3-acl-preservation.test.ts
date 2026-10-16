// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { scanSecurityDefiner } from "../lib/audit-sql-signatures";
import { scanSecurityDefinerWithPreservedAcl } from "../lib/audit-acl-preservation";

const file = "20261015170857_seed_r3_stopped_admission.sql";
const hash = "7f054e3071b243ca6ada6359028c66efa0ac2ba5047a8cf7133f70f1b7924d86";
const body = readFileSync(resolve("supabase/migrations", file), "utf8");

describe("R3 exact existing-function ACL preservation admission", () => {
  it("admits only the reviewed bytes while the underlying H6 still reports all eight requirements", () => {
    expect(createHash("sha256").update(body, "utf8").digest("hex")).toBe(hash);
    expect(scanSecurityDefiner(file, body, true)).toHaveLength(8);
    expect(scanSecurityDefinerWithPreservedAcl(file, body, true)).toEqual([]);
    expect(body).not.toMatch(/^\s*(GRANT|REVOKE|ALTER ROLE|CREATE ROLE)\b/m);
    expect(body).toContain("ADMISSION_PREFLIGHT: four existing routes required");
    expect(body).toContain("p.proowner='postgres'::regrole");
    expect(body).toContain("pg_catalog.unnest(p.proacl)");
    expect(body).toContain("R2_LOCK_DRIFT: physical function identity changed");
    expect(body).toContain("ATOMIC_DEMO_POSTCHECK_admission_terminal");
  });

  it.each([
    ["hash bytes", (s: string) => s + "\n-- byte drift\n"],
    ["body", (s: string) => s.replace("LC_SEED_DEMO_CONSERVACION_PENDIENTE", "LAB_CHANGED_STOP")],
    ["preexisting routes", (s: string) => s.replace("WHERE value<>'null'::jsonb)<>4", "WHERE value<>'null'::jsonb)<>0")],
    ["owner guard", (s: string) => s.replace("p.proowner='postgres'::regrole", "true")],
    ["ACL guard", (s: string) => s.replace("pg_catalog.unnest(p.proacl)", "pg_catalog.unnest(ARRAY['postgres=X/postgres']::text[])")],
    ["OID guard", (s: string) => s.replace("(v_after->>'oid')::oid<>v_expected_oid", "false")],
    ["terminal metadata", (s: string) => s.replaceAll("(v_after-'prosrc'-'proconfig') IS DISTINCT FROM ((v_initial->v_signature)-'prosrc'-'proconfig')", "false")],
  ] as const)("restores all eight ordinary H6 violations after changed %s", (_name, mutate) => {
    const changed = mutate(body);
    expect(changed).not.toBe(body);
    expect(createHash("sha256").update(changed, "utf8").digest("hex")).not.toBe(hash);
    expect(scanSecurityDefinerWithPreservedAcl(file, changed, true)).toHaveLength(8);
  });

  it("rejects a missing function definition instead of granting a partial exemption", () => {
    const changed = body.replace(/EXECUTE \$atomic_stopped_definition_0\$[\s\S]*?\$atomic_stopped_definition_0\$;/, "");
    expect(changed).not.toBe(body);
    expect(scanSecurityDefinerWithPreservedAcl(file, changed, true)).toHaveLength(6);
  });

  it.each([
    "20261015170858_seed_r3_stopped_admission.sql",
    "20261015170857_other.sql",
    "supabase/migrations/20261015170857_seed_r3_stopped_admission.sql",
    "../20261015170857_seed_r3_stopped_admission.sql",
  ])("does not normalize or broadly whitelist another filename/path: %s", (otherFile) => {
    expect(scanSecurityDefinerWithPreservedAcl(otherFile, body, true)).toHaveLength(8);
  });

  it.each([true, false])("always enforces hard TO PUBLIC prohibition at baseline flag %s", (flag) => {
    const changed = body + "\nGRANT EXECUTE ON FUNCTION public.seed_demo_organization() TO PUBLIC;\n";
    expect(scanSecurityDefinerWithPreservedAcl(file, changed, flag)).toContainEqual(
      expect.objectContaining({ check: "H6", detail: expect.stringContaining("TO PUBLIC (prohibido)") }),
    );
  });
});
