import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scanSecurityDefiner } from "../../../scripts/lib/audit-sql-signatures";
import { functionReplayRepairs, isFunctionReplayRepair } from "../../../scripts/lib/audit-hygiene-replay";

const replayName = "20261008190000_replay_proveedor_alta_provisional.sql";
const forwardName = "20261008190100_cierre_acl_triggers_proveedor_provisional.sql";
const approvalFixName = "20261008190200_fix_aprobar_proveedor_validacion.sql";
const read = (file: string) => readFileSync(file, "utf8");
const source = read("drizzle/migrations/0013_proveedor_alta_provisional.sql");
const replay = read(`supabase/migrations/${replayName}`);
const forward = read(`supabase/migrations/${forwardName}`);
const approvalFix = read(`supabase/migrations/${approvalFixName}`);
const triggers = ["_proveedor_factura_no_provisional", "_pago_proveedor_no_provisional"];
const rpc = ["crear_agente_provisional", "aprobar_proveedor_provisional"];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function declaration(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
  const end = sql.indexOf("END $$;", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end + "END $$;".length);
}

function unresolvedH6(candidate: string, name = forwardName) {
  const repairs = functionReplayRepairs(new Map([[replayName, replay], [name, candidate]]));
  return scanSecurityDefiner(replayName, replay, true)
    .filter((v) => !isFunctionReplayRepair(replayName, replay, v, repairs));
}

describe("proveedor provisional: immutable replay and separate restrictive forward", () => {
  it("preserves every byte of Drizzle 0013, including its missing final newline", () => {
    expect(replay).toBe(source);
    expect(Buffer.byteLength(source)).toBe(5260);
    expect(source.endsWith("\n")).toBe(false);
    expect(hash(source)).toBe("d48549bb7e4a69e200919ded4fe89104cc5de7cae99ef4fa5ef1b827e3a61d5b");
  });

  it("maps only the historical replay and preserves the forward as a later correction", () => {
    const mapping = JSON.parse(read("drizzle/replay.json")) as { file: string; sha256: string; replays: string[] }[];
    expect(mapping.filter((entry) => entry.file === "0013_proveedor_alta_provisional.sql")).toEqual([{
      file: "0013_proveedor_alta_provisional.sql", sha256: hash(source), replays: [replayName],
    }]);
    expect(replayName < forwardName).toBe(true);
    const names = readdirSync("supabase/migrations");
    expect(forwardName < approvalFixName).toBe(true);
    for (const name of [replayName, forwardName, approvalFixName]) {
      expect(names.filter((file) => file.startsWith(name.slice(0, 14)))).toEqual([name]);
    }
  });

  it("only reemits the two identical trigger functions with explicit restrictive revocations", () => {
    const expected = triggers.map((name) => declaration(source, name) +
      `\nREVOKE ALL ON FUNCTION public.${name}() FROM PUBLIC, anon, authenticated RESTRICT;\n`).join("\n");
    expect(forward).toBe(expected);
    expect(hash(forward)).toBe("aafff8f8f2e91b68300bc781f43ef187a1801eb745d2877a4b4f580bb71e4cb0");
    expect(forward).not.toMatch(/\bGRANT\b|\bCASCADE\b|ALTER\s|CREATE\s+TRIGGER|audit:allow-no-grants/i);
  });

  it("corrects only the four missing-field appends while reemitting the original RPC ACL", () => {
    const name = "aprobar_proveedor_provisional";
    const start = source.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
    const original = source.slice(start, source.indexOf("TO authenticated;", start) + "TO authenticated;".length);
    const labels = ["RFC / Tax ID", "Contacto", "Correo", "Datos bancarios (CLABE, SWIFT o IBAN)"];
    const expected = labels.reduce((sql, label) => sql.replace(
      `v_faltan := v_faltan || '${label}'`,
      `v_faltan := array_append(v_faltan, '${label}'::text)`,
    ), original);
    const executable = approvalFix.replace(/^--[^\n]*\n/gm, "").trim();
    expect(executable).toBe(expected.trim());
    expect(approvalFix.match(/array_append\(/g)).toHaveLength(4);
    expect(executable).not.toMatch(/\b(?:service_role|CASCADE|ALTER|DROP)\b/i);
    expect(approvalFix).not.toContain("audit:allow-no-grants");
    expect(scanSecurityDefiner(approvalFixName, approvalFix, true)).toEqual([]);
  });

  it("uses the unchanged historical H6 repair mechanism without silencing the literal violations", () => {
    expect(scanSecurityDefiner(replayName, replay, true)).toHaveLength(4);
    expect(scanSecurityDefiner(forwardName, forward, true)).toEqual([]);
    expect(unresolvedH6(forward)).toEqual([]);
    expect(unresolvedH6(forward, "20261008185900_wrong_order.sql")).toHaveLength(4);
  });

  it.each(triggers)("rejects a missing revoke or changed body for %s", (name) => {
    const revoke = `REVOKE ALL ON FUNCTION public.${name}() FROM PUBLIC, anon, authenticated RESTRICT;`;
    expect(unresolvedH6(forward.replace(revoke, ""))).toHaveLength(2);
    const original = declaration(forward, name);
    expect(unresolvedH6(forward.replace(original, () => original.replace("RETURN NEW;", "RETURN NULL;"))))
      .toHaveLength(2);
  });

  it.each([...triggers, ...rpc])("mirrors the complete final declaration and original ACL of %s", (name) => {
    const mirror = read(`supabase/schema/proveedores/${name}.sql`);
    const effectiveSource = name === "aprobar_proveedor_provisional" ? approvalFix : source;
    expect(declaration(mirror, name)).toBe(declaration(effectiveSource, name));
    const expected = triggers.includes(name) ?
      declaration(source, name) + `\nREVOKE ALL ON FUNCTION public.${name}() FROM PUBLIC, anon, authenticated RESTRICT;\n` :
      effectiveSource.slice(effectiveSource.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`),
        effectiveSource.indexOf("TO authenticated;", effectiveSource.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`)) + "TO authenticated;".length) + "\n";
    expect(mirror).toBe(expected);
  });

  it("keeps public RPCs outside the internal CI list and includes both trigger signatures once", () => {
    const ci = read("supabase/tests/rls/_ci_service_role_only.sql");
    for (const name of triggers) expect(ci.split(`('public.${name}()')`)).toHaveLength(2);
    for (const name of rpc) expect(ci).not.toContain(`('public.${name}(`);
  });

  it("represents the three columns, original CHECK, four bodies and two exact trigger events in baseline", () => {
    const baseline = read("supabase/schema/baseline.sql");
    const table = baseline.match(/CREATE TABLE public\.proveedores \([\s\S]*?\n\);/)?.[0] ?? "";
    expect(table).toContain("estado_alta text DEFAULT 'aprobado'::text NOT NULL");
    expect(table).toContain("aprobado_por uuid");
    expect(table).toContain("aprobado_at timestamp with time zone");
    expect(table).toContain("CONSTRAINT proveedores_estado_alta_chk CHECK ((estado_alta = ANY (ARRAY['provisional'::text, 'aprobado'::text])))");
    for (const name of [...triggers, ...rpc]) {
      expect(baseline.split(`CREATE FUNCTION public.${name}(`)).toHaveLength(2);
      const effectiveSource = name === "aprobar_proveedor_provisional" ? approvalFix : source;
      const body = declaration(effectiveSource, name).match(/AS (\$\$[\s\S]*?\$\$);/)?.[1];
      expect(body).toBeDefined();
      expect(baseline).toContain(`AS ${body};`);
    }
    expect(baseline).toContain("CREATE TRIGGER trg_pago_proveedor_no_provisional BEFORE INSERT ON public.pagos_proveedor FOR EACH ROW EXECUTE FUNCTION public._pago_proveedor_no_provisional();");
    expect(baseline).toContain("CREATE TRIGGER trg_proveedor_factura_no_provisional BEFORE INSERT OR UPDATE OF proveedor_id ON public.proveedor_facturas FOR EACH ROW EXECUTE FUNCTION public._proveedor_factura_no_provisional();");
  });
});
