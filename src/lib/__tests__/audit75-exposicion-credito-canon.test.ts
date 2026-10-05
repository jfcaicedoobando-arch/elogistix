import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(__dirname, "../../../supabase/migrations/20261004010000_audit75_credito_facturas_con_saldo.sql"), "utf8");

describe("AUD75: exposición de crédito usa saldo canónico", () => {
  it("cuenta únicamente después de descartar saldo cero y no duplica la fórmula financiera", () => {
    expect(sql).toMatch(/v_saldo := GREATEST\(0, public\.saldo_factura\(f\.id\)\);\s+IF v_saldo <= 0 THEN\s+CONTINUE;\s+END IF;\s+v_facturas := v_facturas \+ 1;/);
    expect(sql).not.toContain("SUM(p.monto_aplicado_factura)");
    expect(sql).not.toContain("nc_aplicadas_en_moneda_factura");
  });

  it("preserva la conversión, los estados vivos y la validación de acceso y TC", () => {
    for (const required of ["c.organization_id = public.current_user_org_id()", "fa.deleted_at IS NULL",
      "('Emitida','Vencida','Parcialmente pagada','Pagada')", "v_en_uso + (v_saldo * f.tc)", "LC_CREDITO_TC_INVALIDO",
      "f.tc < 5 OR f.tc > 40", "ROUND(v_en_uso, 2)", "REVOKE ALL ON FUNCTION public.get_exposicion_credito_cliente(uuid) FROM PUBLIC"]) {
      expect(sql).toContain(required);
    }
  });
});
