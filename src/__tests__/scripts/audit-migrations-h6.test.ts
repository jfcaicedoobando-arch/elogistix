/**
 * Tests para la regla H6 del auditor de migraciones (SECURITY DEFINER).
 * Cubre: caso válido, faltante REVOKE, GRANT ... TO PUBLIC prohibido,
 * whitelist `-- audit:allow-no-grants`, y firma multi-argumento con comentarios.
 */
import { describe, it, expect } from "vitest";
import { scanFile } from "@/../scripts/audit-migrations";

const FILE = "20260724000000_fixture.sql";

function scan(body: string, post = true) {
  return scanFile(FILE, body, post).filter((v) => v.check === "H6");
}

describe("audit-migrations H6", () => {
  it("acepta función SECURITY DEFINER con REVOKE + GRANT EXECUTE a authenticated", () => {
    const sql = `
      CREATE OR REPLACE FUNCTION public.mi_rpc(_arg uuid)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
      BEGIN RETURN; END; $$;

      REVOKE ALL ON FUNCTION public.mi_rpc(uuid) FROM PUBLIC, anon;
      GRANT EXECUTE ON FUNCTION public.mi_rpc(uuid) TO authenticated;
    `;
    expect(scan(sql)).toEqual([]);
  });

  it("falla cuando falta REVOKE", () => {
    const sql = `
      CREATE OR REPLACE FUNCTION public.mi_rpc(_arg uuid)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END; $$;

      GRANT EXECUTE ON FUNCTION public.mi_rpc(uuid) TO authenticated;
    `;
    const v = scan(sql);
    expect(v.length).toBe(1);
    expect(v[0].detail).toMatch(/sin REVOKE/);
  });

  it("falla cuando falta GRANT EXECUTE a rol válido", () => {
    const sql = `
      CREATE OR REPLACE FUNCTION public.mi_rpc(_arg uuid)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END; $$;

      REVOKE ALL ON FUNCTION public.mi_rpc(uuid) FROM PUBLIC;
    `;
    const v = scan(sql);
    expect(v.length).toBe(1);
    expect(v[0].detail).toMatch(/sin GRANT EXECUTE/);
  });

  it("rechaza GRANT EXECUTE ... TO PUBLIC (regla dura, aplica siempre)", () => {
    const sql = `
      CREATE OR REPLACE FUNCTION public.expuesta(_x uuid)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END; $$;

      REVOKE ALL ON FUNCTION public.expuesta(uuid) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.expuesta(uuid) TO PUBLIC;
    `;
    const v = scan(sql, false); // legacy: sólo regla dura
    expect(v.some((x) => x.detail.includes("TO PUBLIC (prohibido)"))).toBe(true);
  });

  it("respeta -- audit:allow-no-grants para helpers privados", () => {
    const sql = `
      -- audit:allow-no-grants
      CREATE OR REPLACE FUNCTION public._helper_privado(_x uuid)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END; $$;
    `;
    expect(scan(sql)).toEqual([]);
  });

  it("ignora funciones SECURITY INVOKER (default)", () => {
    const sql = `
      CREATE OR REPLACE FUNCTION public.publica(_x uuid)
      RETURNS void LANGUAGE plpgsql AS $$ BEGIN RETURN; END; $$;
    `;
    expect(scan(sql)).toEqual([]);
  });

  it("maneja firmas multilínea con comentarios SQL", () => {
    const sql = `
      CREATE OR REPLACE FUNCTION public.compleja(
        _org_id uuid,
        _metodo text, -- 'PUE' | 'PPD'
        _monto numeric(18,4) /* con precisión */
      )
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END; $$;

      REVOKE ALL ON FUNCTION public.compleja(uuid, text, numeric) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.compleja(uuid, text, numeric) TO authenticated;
    `;
    expect(scan(sql)).toEqual([]);
  });

  it("detecta múltiples funciones en un mismo archivo", () => {
    const sql = `
      CREATE OR REPLACE FUNCTION public.a(_x uuid)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END; $$;

      REVOKE ALL ON FUNCTION public.a(uuid) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.a(uuid) TO authenticated;

      CREATE OR REPLACE FUNCTION public.b(_y text)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END; $$;
      -- b olvidó ambos GRANT/REVOKE
    `;
    const v = scan(sql);
    expect(v.length).toBe(2);
    expect(v.every((x) => x.detail.includes("public.b(text)"))).toBe(true);
  });
});

describe("audit-migrations H6 · alias de tipos", () => {
  it("acepta timestamptz en GRANT/REVOKE cuando el CREATE usa 'timestamp with time zone'", () => {
    const sql = `
      CREATE OR REPLACE FUNCTION public.actualizar_x(_id uuid, _at timestamp with time zone DEFAULT NULL::timestamp with time zone)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END; $$;

      REVOKE ALL ON FUNCTION public.actualizar_x(uuid, timestamptz) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.actualizar_x(uuid, timestamptz) TO authenticated;
    `;
    expect(scan(sql)).toEqual([]);
  });

  it("acepta int4/bool/varchar como alias de integer/boolean/character varying", () => {
    const sql = `
      CREATE OR REPLACE FUNCTION public.alias_y(_n integer, _b boolean, _s character varying)
      RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN; END; $$;

      REVOKE ALL ON FUNCTION public.alias_y(int4, bool, varchar) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.alias_y(int4, bool, varchar) TO service_role;
    `;
    expect(scan(sql)).toEqual([]);
  });
});

describe("audit-migrations · ACL agrupada y triggers privados", () => {
  const fn = (name: string, returns = "void") => `CREATE OR REPLACE FUNCTION public.${name}()
    RETURNS ${returns} LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN NULL; END; $$;`;
  it("reconoce cada firma de REVOKE/GRANT agrupados, no sólo la primera", () => {
    const sql = fn("primera") + fn("segunda") + `
      REVOKE ALL ON FUNCTION public.primera(), public.segunda() FROM PUBLIC, anon;
      GRANT EXECUTE ON FUNCTION public.primera(), public.segunda() TO authenticated;`;
    expect(scan(sql)).toEqual([]);
    expect(scan(sql.replace("TO authenticated", "TO PUBLIC"))
      .filter((v) => v.detail.includes("TO PUBLIC (prohibido)"))).toHaveLength(2);
  });
  it("no confunde una firma parecida ni ACL comentadas", () => {
    const sql = fn("segunda") + `
      REVOKE ALL ON FUNCTION public.segunda_extra() FROM PUBLIC;
      -- GRANT EXECUTE ON FUNCTION public.segunda() TO authenticated;`;
    expect(scan(sql)).toHaveLength(2);
  });
  it("acepta un trigger explícitamente cerrado a PUBLIC, anon y authenticated", () => {
    expect(scan(fn("privado", "trigger") +
      "REVOKE ALL ON FUNCTION public.privado() FROM PUBLIC, anon, authenticated;")).toEqual([]);
  });
  it("no exceptúa una RPC normal cerrada ni un trigger que conserve permisos cliente", () => {
    const acl = "REVOKE ALL ON FUNCTION public.privado() FROM PUBLIC, anon, authenticated;";
    expect(scan(fn("privado") + acl)).toHaveLength(1);
    expect(scan(fn("privado", "trigger") + acl.replace(", authenticated", ""))).toHaveLength(1);
    expect(scan(fn("privado", "trigger") + acl +
      "GRANT EXECUTE ON FUNCTION public.privado() TO anon;")).toHaveLength(1);
  });
  it("reconoce cada tabla de GRANT agrupado sin aceptar tablas no incluidas", () => {
    const sql = "CREATE TABLE public.a(id uuid); CREATE TABLE public.b(id uuid);";
    expect(scanFile(FILE, sql + "GRANT SELECT ON public.a, public.b TO authenticated;")).toEqual([]);
    expect(scanFile(FILE, sql + "GRANT SELECT ON public.a TO authenticated;")).toHaveLength(1);
  });
});
