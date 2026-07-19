/**
 * Guardrail Fase M (v13.301.84) — Bug 20.
 *
 * Blinda que `cerrar_factura_proveedor_sin_pago` exige uno de los roles
 * autorizados (admin, admin_org, contador, tesorero) además de la membresía
 * de organización. Rechaza operador, vendedor, viewer, customer_service y
 * auxiliar_contable, que sólo capturan.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readLatestCerrarMigration(): string {
  const dir = path.resolve(__dirname, "../../../supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const f of files) {
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    if (body.includes("CREATE OR REPLACE FUNCTION public.cerrar_factura_proveedor_sin_pago")) {
      return body;
    }
  }
  throw new Error("No se encontró migración con cerrar_factura_proveedor_sin_pago");
}

describe("Fase M — cerrar_factura_proveedor_sin_pago exige rol autorizado", () => {
  const sql = readLatestCerrarMigration();
  const idx = sql.lastIndexOf(
    "CREATE OR REPLACE FUNCTION public.cerrar_factura_proveedor_sin_pago",
  );
  const fnBody = sql.slice(idx, sql.indexOf("$function$;", idx) + 1 || sql.indexOf("$$;", idx));

  it("levanta LC_CERRAR_FACTURA_SIN_ROL cuando no hay rol autorizado", () => {
    expect(fnBody).toMatch(/LC_CERRAR_FACTURA_SIN_ROL/);
    expect(fnBody).toMatch(/ERRCODE = '42501'/);
  });

  it("acepta admin, admin_org, contador, tesorero y super_admin como bypass", () => {
    for (const rol of ["admin", "admin_org", "contador", "tesorero", "super_admin"]) {
      expect(fnBody, `debe reconocer el rol ${rol}`).toMatch(
        new RegExp(`has_role\\(v_uid,\\s*'${rol}'`),
      );
    }
  });

  it("NO acepta operador, vendedor, viewer, customer_service ni auxiliar_contable", () => {
    for (const rol of [
      "operador",
      "vendedor",
      "viewer",
      "customer_service",
      "auxiliar_contable",
    ]) {
      expect(fnBody, `no debería listar el rol ${rol}`).not.toMatch(
        new RegExp(`has_role\\(v_uid,\\s*'${rol}'`),
      );
    }
  });

  it("registra el rol ejecutor en la bitácora", () => {
    expect(fnBody).toMatch(/'rol_ejecutor',\s*v_rol_ejecutor/);
  });

  it("conserva REVOKE FROM PUBLIC + GRANT authenticated", () => {
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.cerrar_factura_proveedor_sin_pago\(uuid, text, text\) FROM PUBLIC, anon/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.cerrar_factura_proveedor_sin_pago\(uuid, text, text\) TO authenticated, service_role/,
    );
  });
});
