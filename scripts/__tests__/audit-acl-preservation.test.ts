// @vitest-environment node
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

const proformaFile = "20261011180000_proforma_cancelada_acciones_terminales.sql";
const proformaBody = readFileSync(resolve("supabase/migrations", proformaFile), "utf8");

describe("reconstructed r1 exact cancelled-proforma catalog", () => {
  it("permits only the reviewed pair while ordinary H6 retains sixteen findings", () => {
    expect(scanSecurityDefiner(proformaFile, proformaBody, true)).toHaveLength(16);
    expect(scanSecurityDefinerWithPreservedAcl(proformaFile, proformaBody, true)).toEqual([]);
  });
  it("rejects different names and cross-use of the older reviewed pair", () => {
    for (const name of ["20261011180100_other.sql", file]) {
      expect(scanSecurityDefinerWithPreservedAcl(name, proformaBody, true)).toHaveLength(16);
    }
    expect(scanSecurityDefinerWithPreservedAcl(proformaFile, body, true)).toHaveLength(4);
  });
  it.each([
    ["bytes", (s: string) => s + "\n-- changed\n"],
    ["catalog omitted", (s: string) => s.replace(/DO \$catalog\$[\s\S]*?\$catalog\$;/, "")],
    ["owner omitted", (s: string) => s.replace("pg_get_userbyid(p.proowner)<>'postgres'", "false")],
    ["owner changed", (s: string) => s.replace("pg_get_userbyid(p.proowner)<>'postgres'", "pg_get_userbyid(p.proowner)<>'authenticated'")],
    ["definer omitted", (s: string) => s.replace("p.prosecdef IS DISTINCT FROM expected.security_definer", "false")],
    ["definer changed", (s: string) => s.replace("('public.aceptar_proforma_sin_autorizacion(uuid)', true,", "('public.aceptar_proforma_sin_autorizacion(uuid)', false,")],
    ["search path omitted", (s: string) => s.replace("p.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]", "false")],
    ["null ACL allowed", (s: string) => s.replace("p.proacl IS NULL", "false")],
    ["ACL superset allowed", (s: string) => s.replace("p.proacl @> expected.acl AND p.proacl <@ expected.acl", "p.proacl @> expected.acl")],
    ["ACL subset allowed", (s: string) => s.replace("p.proacl @> expected.acl AND p.proacl <@ expected.acl", "p.proacl <@ expected.acl")],
    ["ACL changed", (s: string) => s.replace("'{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]", "'{postgres=X/postgres,authenticated=X/postgres,anon=X/postgres,service_role=X/postgres}'::aclitem[]")],
    ["hosted ACL superset allowed", (s: string) => s.replace("AND p.proacl <@ '{=X/postgres,postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]", "AND true")],
    ["hosted ACL applied to other signatures", (s: string) => s.replace("expected.signature = 'public.enforce_proforma_aceptada_before_factura()'", "true")],
    ["unknown portal body allowed", (s: string) => s.replace("'e227680fb6411452fd5cb9e76569271e']", "'e227680fb6411452fd5cb9e76569271e','00000000000000000000000000000000']")],
    ["source marker changed", (s: string) => s.replace("PROFORMA_CANCELADA_PRECONDITION", "CHANGED_PRECONDITION")],
    ["source preconditions omitted", (s: string) => s.replace(/DO \$preconditions\$[\s\S]*?\$preconditions\$;/, "")],
    ["postcondition omitted", (s: string) => s.replace(/DO \$metadata\$[\s\S]*?\$metadata\$;/, "")],
  ] as const)("restores H6 when %s", (_name, mutate) => {
    const changed = mutate(proformaBody);
    expect(changed).not.toBe(proformaBody);
    expect(scanSecurityDefinerWithPreservedAcl(proformaFile, changed, true)).toHaveLength(16);
  });
  it.each([true, false])("retains PUBLIC prohibition at baseline flag %s", (flag) => {
    const changed = proformaBody + "\nGRANT EXECUTE ON FUNCTION public.aceptar_proforma_sin_autorizacion(uuid) TO PUBLIC;\n";
    expect(scanSecurityDefinerWithPreservedAcl(proformaFile, changed, flag))
      .toContainEqual(expect.objectContaining({ check: "H6", detail: expect.stringContaining("TO PUBLIC (prohibido)") }));
  });
  it("covers exactly nine signatures, including eight definers and the historical invoker", () => {
    const catalog = proformaBody.match(/DO \$catalog\$([\s\S]*?)\$catalog\$;/)?.[1] ?? "";
    expect(catalog.match(/\('public\./g)).toHaveLength(9);
    expect(catalog.match(/, true, '/g)).toHaveLength(8);
    expect(catalog).toContain("('public.enforce_proforma_aceptada_before_factura()', false,");
  });
});
