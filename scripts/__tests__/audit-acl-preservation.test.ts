import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { scanSecurityDefiner } from "../lib/audit-sql-signatures";
import { scanSecurityDefinerWithPreservedAcl } from "../lib/audit-acl-preservation";

const file = "20261009174000_cxp_centavo_sin_cobertura.sql";
const body = readFileSync(resolve("supabase/migrations", file), "utf8");

describe("exact reviewed ACL-preserving forward", () => {
  it("accepts only the reviewed forward while ordinary H6 still requires DCL", () => {
    expect(scanSecurityDefiner(file, body, true)).toHaveLength(4);
    expect(scanSecurityDefinerWithPreservedAcl(file, body, true)).toEqual([]);
  });
  it("does not exempt identical bytes under a different migration name", () => {
    expect(scanSecurityDefinerWithPreservedAcl("20261009174100_other.sql", body, true)).toHaveLength(4);
  });
  it.each([
    body + "\n-- byte drift\n",
    body.replace("p.proacl @> expected.acl", "true"),
    body.replace("CXPCENT_PRECONDITION", "CHANGED_PRECONDITION"),
    body.replace(/DO \$metadata\$[\s\S]*?\$metadata\$;/g, ""),
  ])("does not exempt mutated guards or bytes", (changed) => {
    expect(scanSecurityDefinerWithPreservedAcl(file, changed, true)).toHaveLength(4);
  });
  it.each([true, false])("keeps the TO PUBLIC hard prohibition (post baseline %s)", (postBaseline) => {
    const changed = body + "\nGRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO PUBLIC;\n";
    expect(scanSecurityDefinerWithPreservedAcl(file, changed, postBaseline))
      .toContainEqual(expect.objectContaining({ check: "H6", detail: expect.stringContaining("TO PUBLIC (prohibido)") }));
  });
});
