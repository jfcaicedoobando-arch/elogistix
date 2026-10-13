// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { scanSecurityDefiner } from "../lib/audit-sql-signatures";
import { scanSecurityDefinerWithPreservedAcl } from "../lib/audit-acl-preservation";

const file = "20261013151000_padres_activos_recalculo_tc.sql";
const body = readFileSync(resolve("supabase/migrations", file), "utf8");

describe("remaining-parent exact ACL-preserving forward", () => {
  it("preserves the ordinary H6 rule and admits only this exact reviewed pair", () => {
    expect(scanSecurityDefiner(file, body, true)).toHaveLength(2);
    expect(scanSecurityDefinerWithPreservedAcl(file, body, true)).toEqual([]);
    expect(scanSecurityDefinerWithPreservedAcl("20261013141600_other.sql", body, true)).toHaveLength(2);
    expect(body).not.toMatch(/^\s*(GRANT|REVOKE|ALTER ROLE|CREATE ROLE)\b/m);
  });
  it.each([
    ["bytes", (s: string) => s + "\n-- byte drift\n"],
    ["source admission", (s: string) => s.replace(/DO \$preconditions\$[\s\S]*?\$preconditions\$;/, "")],
    ["postcondition", (s: string) => s.replace(/DO \$metadata\$[\s\S]*?\$metadata\$;/, "")],
    ["owner", (s: string) => s.replace("p.proowner IS DISTINCT FROM b.proowner", "false")],
    ["ACL", (s: string) => s.replace("p.proacl IS DISTINCT FROM b.proacl", "false")],
    ["security", (s: string) => s.replace("p.prosecdef IS DISTINCT FROM b.prosecdef", "false")],
    ["search path", (s: string) => s.replace("p.proconfig IS DISTINCT FROM b.proconfig", "false")],
    ["lock", (s: string) => s.replace("FOR NO KEY UPDATE", "")],
    ["default argument", (s: string) => s.replace("p.proargdefaults::text IS DISTINCT FROM b.argdefaults", "false")],
    ["parent guard", (s: string) => s.replace("AND deleted_at IS NULL", "")],
  ] as const)("restores H6 for mutated %s", (_name, mutate) => {
    const changed = mutate(body);
    expect(changed).not.toBe(body);
    expect(scanSecurityDefinerWithPreservedAcl(file, changed, true)).toHaveLength(2);
  });
  it.each([true, false])("retains the hard PUBLIC prohibition at baseline flag %s", (flag) => {
    const changed = body + "\nGRANT EXECUTE ON FUNCTION public.actualizar_tc_embarque_dof(uuid,date) TO PUBLIC;\n";
    expect(scanSecurityDefinerWithPreservedAcl(file, changed, flag)).toContainEqual(
      expect.objectContaining({ check: "H6", detail: expect.stringContaining("TO PUBLIC (prohibido)") }),
    );
  });
});
