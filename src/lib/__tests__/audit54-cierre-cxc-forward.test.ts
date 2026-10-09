import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { extraerFunciones } from "../../../scripts/lib/replayMirrorFunctions";
import { scanFile } from "../../../scripts/audit-migrations";

const root = path.resolve(__dirname, "../../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
const forward = read("supabase/migrations/20261009005400_audit54_cierre_cxc_saldo_real.sql");
const previous = read("supabase/migrations/20261007001300_audit139_cierre_saldo_atribuido.sql");
// Historical AUD54 contract precedes later forwards; current baseline still tracks the live mirror.
const mirror = read("scripts/ci/fixtures/audit54-cierre-post-forward.sql");
const currentMirror = read("supabase/schema/embarques/validar_cierre_embarque.sql");
const baseline = read("supabase/schema/baseline.sql");

function source(sql: string): string {
  const declaration = /CREATE(?: OR REPLACE)? FUNCTION public\.validar_cierre_embarque\(p_embarque_id uuid\)[\s\S]*?AS \$\$([\s\S]*?)\$\$;/.exec(sql);
  if (!declaration) throw new Error("Missing full validar_cierre_embarque definition");
  return declaration[1];
}

const oldSource = source(previous);
const newSource = source(mirror);
const preimage = /v_expected text := \$audit54_expected_source\$([\s\S]*?)\$audit54_expected_source\$;/.exec(forward)?.[1];
const compact = (value: string) => value.split("\n").filter((line) => line.trim()).join("\n");
const endCxc = "  SELECT COUNT(*), COALESCE(array_agg(pf.id)";

describe("AUD54 shipment CxC forward composition", () => {
  it("satisfies migration hygiene without exceptions or runtime text patches", () => {
    expect(scanFile("20261009005400_audit54_cierre_cxc_saldo_real.sql", forward)).toEqual([]);
  });

  it("re-emits one complete function matching its pinned historical mirror", () => {
    const definitions = extraerFunciones(forward);
    expect(definitions.map((definition) => definition.firma)).toEqual(["validar_cierre_embarque(uuid)"]);
    expect(definitions).toEqual(extraerFunciones(mirror));
    expect(source(forward)).toBe(newSource);
  });

  it("requires the exact effective AUD139 preimage and fails closed on drift", () => {
    expect(preimage).toBe(oldSource);
    expect(forward).toMatch(/IF v_oid IS NULL THEN[\s\S]*?RAISE EXCEPTION 'AUD54_CXC_PREIMAGE:/);
    expect(forward).toMatch(/IF v_source IS DISTINCT FROM v_expected THEN\s*RAISE EXCEPTION 'AUD54_CXC_PREIMAGE:/);
    expect(forward.indexOf("IF v_source IS DISTINCT FROM v_expected")).toBeLessThan(
      forward.indexOf("CREATE OR REPLACE FUNCTION public.validar_cierre_embarque"),
    );
    expect(preimage).not.toBe(oldSource.replace("v_cxp_saldo numeric := 0", "v_cxp_saldo numeric := 1"));
    expect(forward).not.toMatch(/\bEXECUTE\s+(?:v_|format\s*\()|replace\s*\(\s*pg_get_functiondef/i);
  });

  it("preserves every other closure rule and the original shipment attribution", () => {
    const oldStart = oldSource.indexOf("  -- CxC: una factura con estado 'Pagada'");
    const newStart = newSource.indexOf("  -- AUD54: clasificar en moneda documental");
    const oldEnd = oldSource.indexOf(endCxc, oldStart);
    const newEnd = newSource.indexOf(endCxc, newStart);
    expect([oldStart, newStart, oldEnd, newEnd].every((index) => index >= 0)).toBe(true);
    expect(newSource.slice(0, newStart)).toBe(oldSource.slice(0, oldStart));
    expect(newSource.slice(newEnd)).toBe(oldSource.slice(oldEnd));
    const cxc = newSource.slice(newStart, newEnd);
    expect(cxc).toContain("f.embarque_id=p_embarque_id AND f.organization_id=v_emb.organization_id");
    expect(cxc).toContain("f.estado NOT IN ('Cancelada','Sustituida','Borrador')");
    expect(cxc).not.toMatch(/conceptos_factura|conceptos_venta|proveedor_facturas|reparto_proporcional/);
  });

  it("keeps native monetary classification separate from raw financial facts", () => {
    const cxc = newSource.slice(newSource.indexOf("  -- AUD54: clasificar"), newSource.indexOf(endCxc));
    expect(cxc).toContain("public.saldo_factura(f.id) AS saldo_exacto");
    expect(cxc).toContain("f.estado='Pagada' AND NOT f.tiene_pago_activo THEN 0");
    expect(cxc).toContain("GREATEST(ROUND(f.saldo_exacto,2),0) END AS saldo");
    expect(cxc).toContain("COUNT(*) FILTER (WHERE f.saldo>0)");
    expect(cxc).toContain("WHERE (m->>'saldo')::numeric > 0");
    expect(cxc).toContain("px.monto_aplicado_factura>0");
    expect(cxc).toContain("NOT public.pago_rep_anulado(px.estado_rep)");
    expect(cxc).toContain("NOT public.pago_rep_anulado(pf.estado_rep)");
    expect(cxc).toContain("public.nc_convertida_a_moneda_factura(");
    expect(cxc).toContain("nc.estado IN ('Timbrada','Aplicada')");
    expect(cxc).toContain("nc.organization_id=v_emb.organization_id");
    expect(cxc).not.toContain("tipo_cambio_usd");
  });

  it("keeps the current pg_dump baseline aligned with the current schema mirror", () => {
    expect(compact(source(baseline))).toBe(compact(source(currentMirror)));
    expect(baseline).toContain("REVOKE ALL ON FUNCTION public.validar_cierre_embarque(p_embarque_id uuid) FROM PUBLIC;");
    expect(baseline).toContain("GRANT ALL ON FUNCTION public.validar_cierre_embarque(p_embarque_id uuid) TO authenticated;");
    expect(baseline).toContain("GRANT ALL ON FUNCTION public.validar_cierre_embarque(p_embarque_id uuid) TO service_role;");
  });

  it("rejects catalog drift against the approved main contract before any mutation", () => {
    const createIndex = forward.indexOf("CREATE TEMP TABLE audit54_cxc_metadata");
    const preflight = forward.slice(0, createIndex);
    expect(preflight).toContain("'owner','postgres'::regrole::oid,'security_definer',true");
    expect(preflight).toContain("'config',ARRAY['search_path=public']::text[]");
    expect(preflight).toContain("'arguments',('uuid'::regtype::oid)::text,'returns','jsonb'::regtype::oid");
    expect(preflight).toContain("'language',(SELECT oid FROM pg_language WHERE lanname='plpgsql')");
    expect(preflight).toContain("'kind','f','volatility','v','strict',false,'parallel','u'");
    expect(preflight).toContain("'leakproof',false,'returns_set',false,'cost',100,'rows',0");
    expect(preflight).toContain("'argument_count',1,'default_count',0,'variadic',0,'support',0");
    expect(preflight).toContain("'variadic',p.provariadic::bigint,'support',p.prosupport::oid::bigint");
    expect(preflight).toContain("'argument_names',ARRAY['p_embarque_id']::text[]");
    for (const name of ["all_argument_types", "argument_modes", "argument_defaults", "transforms", "binary", "sql_body"]) {
      expect(preflight).toContain(`'${name}',NULL::text`);
    }
    expect(preflight).toMatch(/IF v_metadata IS DISTINCT FROM v_expected_metadata THEN\s*RAISE EXCEPTION 'AUD54_CXC_PRECATALOG:/);
    expect(createIndex).toBeLessThan(forward.indexOf("CREATE OR REPLACE FUNCTION public.validar_cierre_embarque"));
    expect(preflight).not.toMatch(/(?:CREATE|ALTER|REVOKE|GRANT|DROP)\s+(?:TEMP|FUNCTION|TABLE|ALL|EXECUTE)/);
  });

  it("rejects missing or extra grants, grantors and grant options before replacing the function", () => {
    const preflight = forward.slice(0, forward.indexOf("CREATE TEMP TABLE audit54_cxc_metadata"));
    expect(preflight).toMatch(/v_expected_acl jsonb := jsonb_build_array\(\s*jsonb_build_array\('authenticated','postgres','EXECUTE',false\),\s*jsonb_build_array\('postgres','postgres','EXECUTE',false\),\s*jsonb_build_array\('service_role','postgres','EXECUTE',false\)\);/);
    expect(preflight).toContain("aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner)))");
    expect(preflight).toContain("pg_get_userbyid(a.grantor)::text,a.privilege_type,a.is_grantable");
    expect(preflight).toContain("CASE WHEN a.grantee=0 THEN 'PUBLIC'");
    expect(preflight).toMatch(/IF v_acl IS DISTINCT FROM v_expected_acl THEN\s*RAISE EXCEPTION 'AUD54_CXC_PREACL:/);
    expect(preflight).not.toMatch(/^\s*(?:GRANT|REVOKE)\b/m);
  });

  it("checks all effective privileges before and after including inherited anonymous execution", () => {
    const preflight = forward.slice(0, forward.indexOf("CREATE TEMP TABLE audit54_cxc_metadata"));
    expect(preflight).toContain("'public',jsonb_build_array(false,false),'anon',jsonb_build_array(false,false)");
    expect(preflight).toContain("'authenticated',jsonb_build_array(true,false),'service_role',jsonb_build_array(true,false)");
    expect(preflight).toContain("'postgres',jsonb_build_array(true,true)");
    expect(preflight).toContain("WHERE (v_effective->e.key) IS DISTINCT FROM e.value");
    expect(preflight).toContain("AUD54_CXC_PREEFFECTIVE:");
    expect(preflight).toContain("v_effective IS NULL");
    expect(forward.split("SELECT rolname::text AS role_name FROM pg_catalog.pg_roles").length - 1).toBe(2);
    expect(forward.split("UNION ALL SELECT 'public'").length - 1).toBe(2);
    expect(forward.split("pg_catalog.has_function_privilege(r.role_name::name,v_oid,'EXECUTE')").length - 1).toBe(2);
    expect(forward.split("pg_catalog.has_function_privilege(r.role_name::name,v_oid,'EXECUTE WITH GRANT OPTION')").length - 1).toBe(2);
    expect(forward.split("jsonb_typeof(e.value->0) IS DISTINCT FROM 'boolean'").length - 1).toBe(2);
    expect(forward.split("jsonb_typeof(e.value->1) IS DISTINCT FROM 'boolean'").length - 1).toBe(2);
    expect(forward).toContain("OR v_effective_after IS DISTINCT FROM v_effective_before");
    expect(forward).toContain("WHERE (v_effective_after->e.key) IS DISTINCT FROM e.value");
    expect(forward).not.toMatch(/^\s*(?:GRANT|REVOKE)\s+(?:authenticated|postgres|service_role)\s+(?:TO|FROM)/mi);
  });

  it("requires the checkpoint contract inside the existing SQL aggregate before applying the forward", () => {
    const runner = read("scripts/ci/rls-prepare-db.sh");
    const workflow = read(".github/workflows/rls-tests.yml");
    const harness = read("scripts/ci/audit54-cxc-forward-runtime.sh");
    expect(fs.existsSync(path.join(root, ".github/workflows/audit54-cxc-forward-runtime.yml"))).toBe(false);
    expect(workflow).toContain("name: RLS tests result");
    expect(workflow).toContain("run: bash scripts/ci/rls-prepare-db.sh");
    expect(workflow).toContain("ISOLATED_QA_DB: '1'");
    expect(workflow).toContain("AUD54_CI: '1'");
    expect(runner).toContain('if [[ "${AUD54_CI:-}" == 1 && "$base" == "$AUD54_FORWARD" ]]; then');
    expect(runner).toContain('if [[ "${AUD54_CI:-}" == 1 && "$audit54_runtime_checked" != 1 ]]; then');
    expect(workflow).not.toMatch(/continue-on-error/);
    expect(runner).toContain("pg_dump --schema-only --file=\"$checkpoint\"");
    expect(runner).toContain("AUD54_CXC_CHECKPOINT=\"$checkpoint\"");
    expect(runner).toContain("audit54_runtime_checked=1");
    expect(runner).toContain("AUD54 runtime checkpoint was not executed before its forward");
    expect(runner.indexOf("    audit54_checkpoint_runtime")).toBeLessThan(
      runner.indexOf('  if stub_extensiones "$f" | "${PSQL[@]}" --single-transaction; then'),
    );
    expect(harness.indexOf("# Validate the unmodified checkpoint first")).toBeLessThan(
      harness.indexOf("\nseed\nbefore=\"$(catalog_hash full)\""),
    );
    expect(harness).toContain("GRANT authenticated TO anon;");
    expect(harness).toContain("AUD54_CXC_PREEFFECTIVE");
    expect(harness).toContain("assert_memberships inherited-anonymous-execute");
    expect(harness).not.toMatch(/DROP FUNCTION/);
  });

  it("uses the caller transaction, rejects autocommit first and validates all postconditions", () => {
    const executable = forward.replace(/^--.*$/gm, "").trim();
    expect(executable).toMatch(/^SAVEPOINT audit54_cxc_forward;\s*DO \$audit54_preimage\$/);
    expect(forward.trim()).toMatch(/DROP TABLE pg_temp\.audit54_cxc_metadata;\nRELEASE SAVEPOINT audit54_cxc_forward;$/);
    expect(forward).not.toMatch(/^\s*(?:BEGIN|COMMIT|ROLLBACK)\s*;/m);
    expect(forward).toContain("CREATE TEMP TABLE audit54_cxc_metadata ON COMMIT DROP AS");
    expect(forward).toMatch(/IF v_after IS DISTINCT FROM v_before OR v_acl_after IS DISTINCT FROM v_acl_before[\s\S]*?RAISE EXCEPTION 'AUD54_CXC_METADATA:/);
    const bodyHash = crypto.createHash("md5").update(newSource).digest("hex");
    expect(forward).toContain(`OR v_source_hash IS DISTINCT FROM '${bodyHash}' THEN`);
    expect(crypto.createHash("sha256").update(newSource).digest("hex")).toBe("17217b03c4a5d5241347d41f1edffe261ef7b905ddd7b0dcb26078a9f1ccaf77");
    for (const column of ["prosecdef", "proconfig", "proargtypes", "prorettype", "prolang", "prokind", "provolatile", "proisstrict", "proparallel", "proleakproof", "proretset", "procost", "prorows", "pronargs", "pronargdefaults", "provariadic", "prosupport", "proargnames", "proallargtypes", "proargmodes", "proargdefaults", "protrftypes", "probin", "prosqlbody"]) {
      expect(forward.split(`p.${column}`).length - 1).toBe(2);
    }
    expect(forward).toContain("REVOKE ALL ON FUNCTION public.validar_cierre_embarque(uuid) FROM PUBLIC, anon;");
    expect(forward).toContain("GRANT EXECUTE ON FUNCTION public.validar_cierre_embarque(uuid) TO authenticated, service_role;");
    expect(forward).not.toMatch(/(?:INSERT INTO|UPDATE|DELETE FROM|ALTER|DROP)\s+public\./i);
  });
});

