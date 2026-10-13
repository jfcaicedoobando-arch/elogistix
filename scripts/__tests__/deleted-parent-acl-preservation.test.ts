// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { scanSecurityDefiner } from "../lib/audit-sql-signatures";
import { scanSecurityDefinerWithPreservedAcl } from "../lib/audit-acl-preservation";

const file = "20261013141500_factura_eliminada_guard_hijos.sql";
const body = readFileSync(resolve("supabase/migrations", file), "utf8");

describe("deleted-parent exact ACL-preserving forward", () => {
  it("preserves the ordinary H6 rule and admits only this exact reviewed pair", () => {
    expect(scanSecurityDefiner(file, body, true)).toHaveLength(4);
    expect(scanSecurityDefinerWithPreservedAcl(file, body, true)).toEqual([]);
    expect(scanSecurityDefinerWithPreservedAcl("20261013141600_other.sql", body, true)).toHaveLength(4);
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
    ["parent guard", (s: string) => s.replace("AND deleted_at IS NULL", "")],
  ] as const)("restores H6 for mutated %s", (_name, mutate) => {
    const changed = mutate(body);
    expect(changed).not.toBe(body);
    expect(scanSecurityDefinerWithPreservedAcl(file, changed, true)).toHaveLength(4);
  });
  it.each([true, false])("retains the hard PUBLIC prohibition at baseline flag %s", (flag) => {
    const changed = body + "\nGRANT EXECUTE ON FUNCTION public.duplicar_factura_para_sustitucion(uuid) TO PUBLIC;\n";
    expect(scanSecurityDefinerWithPreservedAcl(file, changed, flag)).toContainEqual(
      expect.objectContaining({ check: "H6", detail: expect.stringContaining("TO PUBLIC (prohibido)") }),
    );
  });
});
