/**
 * Guardrail Fase F (v13.301.75) — candados server-side de pagos, REP y NCs.
 *
 * Blinda que la última migración que introduce los 4 triggers de Fase F:
 *  - Crea `saldo_factura_bruto(uuid)` con SECURITY DEFINER y grant explícito.
 *  - Instala los 4 asserts + triggers en las tablas correctas.
 *  - Bloquea facturas Cancelada/Sustituida/Borrador en pagos y REP.
 *  - Exige `uuid_fiscal IS NOT NULL` para permitir REP.
 *  - Compara NCs contra `saldo_factura_bruto` (no `saldo_factura`, para no
 *    auto-restarse).
 *  - Detecta sobrepagos en pagos CxC (saldo negativo > 1 centavo).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readLatestFaseFMigration(): string {
  const dir = path.resolve(__dirname, "../../../supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const f of files) {
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    if (
      body.includes("assert_factura_viva_para_pago") &&
      body.includes("assert_nc_no_excede_saldo")
    ) {
      return body;
    }
  }
  throw new Error("No se encontró migración de Fase F (candados pagos/REP/NC)");
}

function readLatestRepGuardMigration(): string {
  const dir = path.resolve(__dirname, "../../../supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().reverse();
  for (const f of files) {
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    if (body.includes("FUNCTION public.assert_factura_viva_para_rep()")) {
      return body;
    }
  }
  throw new Error("No se encontró migración con assert_factura_viva_para_rep");
}


describe("Fase F — candados de pagos, REP y notas de crédito", () => {
  const sql = readLatestFaseFMigration();

  it("crea saldo_factura_bruto(uuid) STABLE + SECURITY DEFINER + GRANT", () => {
    expect(sql).toMatch(/FUNCTION public\.saldo_factura_bruto\(p_factura_id uuid\)[\s\S]{0,300}STABLE[\s\S]{0,80}SECURITY DEFINER/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.saldo_factura_bruto\(uuid\) TO authenticated, service_role/);
  });

  it("saldo_factura_bruto excluye Cancelada/Sustituida/Borrador (devuelve 0)", () => {
    // La rama CASE debe tratar los 3 estados como saldo 0.
    expect(sql).toMatch(
      /saldo_factura_bruto[\s\S]{0,400}IN \('Cancelada','Sustituida','Borrador'\) THEN 0/,
    );
  });

  it("instala trg_pago_factura_viva en pagos_factura (BEFORE INSERT OR UPDATE)", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_pago_factura_viva[\s\S]{0,200}BEFORE INSERT OR UPDATE ON public\.pagos_factura[\s\S]{0,200}assert_factura_viva_para_pago/,
    );
  });

  it("assert_factura_viva_para_pago bloquea los 3 estados no vivos", () => {
    expect(sql).toMatch(
      /assert_factura_viva_para_pago[\s\S]{0,800}IN \('Cancelada','Sustituida','Borrador'\)[\s\S]{0,200}LC_PAGO_FACTURA_NO_VIVA/,
    );
  });

  it("assert_factura_viva_para_pago detecta sobrepagos con saldo bruto − pagos vivos", () => {
    expect(sql).toMatch(/saldo_factura_bruto\(NEW\.factura_id\)/);
    expect(sql).toMatch(/LC_PAGO_SOBREPAGO/);
    expect(sql).toMatch(/v_saldo_actual < -0\.01/);
  });

  it("instala trg_pago_proveedor_factura_viva sobre pagos_proveedor con estado Cancelada", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_pago_proveedor_factura_viva[\s\S]{0,200}BEFORE INSERT OR UPDATE ON public\.pagos_proveedor/,
    );
    expect(sql).toMatch(/assert_proveedor_factura_viva_para_pago[\s\S]{0,400}v_estado = 'Cancelada'[\s\S]{0,120}LC_PAGO_CXP_NO_VIVA/);
  });

  it("instala trg_pago_factura_rep_viva sobre pagos_factura acotado a las 3 columnas de REP", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_pago_factura_rep_viva[\s\S]{0,300}BEFORE INSERT OR UPDATE OF uuid_rep, estado_rep, facturapi_rep_id ON public\.pagos_factura/,
    );
  });

  it("assert_factura_viva_para_rep exige uuid_fiscal IS NOT NULL y estados vivos", () => {
    expect(sql).toMatch(/LC_REP_FACTURA_SIN_TIMBRAR[\s\S]{0,60}/);
    expect(sql).toMatch(/v_uuid_fiscal IS NULL/);
    expect(sql).toMatch(
      /assert_factura_viva_para_rep[\s\S]{0,1200}IN \('Cancelada','Sustituida','Borrador'\)[\s\S]{0,200}LC_REP_FACTURA_NO_VIVA/,
    );
  });

  it("instala trg_nc_no_excede_saldo sobre factura_notas_credito y compara contra saldo_factura_bruto", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_nc_no_excede_saldo[\s\S]{0,200}BEFORE INSERT OR UPDATE ON public\.factura_notas_credito/,
    );
    expect(sql).toMatch(/assert_nc_no_excede_saldo[\s\S]{0,900}saldo_factura_bruto\(NEW\.factura_id\)/);
    expect(sql).toMatch(/LC_NC_EXCEDE_SALDO/);
  });

  it("assert_nc_no_excede_saldo excluye la NC en curso al sumar previas (evita auto-restarse)", () => {
    expect(sql).toMatch(/nc\.id <> COALESCE\(NEW\.id/);
  });

  it("guarda de pago usa WHEN (NEW.deleted_at IS NULL) para no re-validar soft-deletes", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_pago_factura_viva[\s\S]{0,300}WHEN \(NEW\.deleted_at IS NULL\)/,
    );
    expect(sql).toMatch(
      /CREATE TRIGGER trg_pago_proveedor_factura_viva[\s\S]{0,300}WHEN \(NEW\.deleted_at IS NULL\)/,
    );
  });
});

describe("Fase F hotfix v13.301.76 — early-exit del guard de REP", () => {
  const sql = readLatestRepGuardMigration();

  it("early-exit depende sólo de uuid_rep + facturapi_rep_id (no de estado_rep)", () => {
    // La versión hotfix debe salir temprano cuando ambos son NULL, sin consultar estado_rep.
    expect(sql).toMatch(
      /assert_factura_viva_para_rep[\s\S]{0,600}IF NEW\.uuid_rep IS NULL AND NEW\.facturapi_rep_id IS NULL THEN\s+RETURN NEW;\s+END IF;/,
    );
    // Regresión: la lista de estados 'pendiente'/'cancelado' ya no debe estar en el early-exit.
    const fnBody = sql.match(/FUNCTION public\.assert_factura_viva_para_rep\(\)[\s\S]*?\$\$;/)?.[0] ?? "";
    expect(fnBody).not.toMatch(/estado_rep IN \(''/);
  });

  it("trigger trg_pago_factura_rep_viva tiene WHEN clause que corta antes de invocar la función", () => {
    expect(sql).toMatch(
      /CREATE TRIGGER trg_pago_factura_rep_viva[\s\S]{0,400}WHEN \(NEW\.uuid_rep IS NOT NULL OR NEW\.facturapi_rep_id IS NOT NULL\)/,
    );
  });
});
