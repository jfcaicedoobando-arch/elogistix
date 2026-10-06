import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { objetoImpDeTipoIva, tipoIvaEfectivo } from "@/lib/financial/tipoIvaSat";
import { buildFacturapiPayload, type FacturaContext } from "../../../../../supabase/functions/facturapi-emitir/helpers";

const migration = readFileSync("supabase/migrations/20261006225000_proforma_no_objeto_snapshot.sql", "utf8");
const baseline = readFileSync("supabase/schema/baseline.sql", "utf8");
const table = baseline.split("CREATE TABLE public.proforma_conceptos_consolidados (")[1].split("\n);")[0];

// SQL execution coverage is in supabase/tests/proforma_no_objeto_snapshot.sql.
// These contracts guard the reviewed DDL and real downstream pure payload builder.
describe("consolidated no_objeto snapshot contract", () => {
  it("allows an absent rate only for explicit no_objeto, retaining other requirements", () => {
    expect(migration).toContain("tasa_iva_aplicada IS NOT NULL OR tipo_iva IS NOT DISTINCT FROM 'no_objeto'");
    expect(table).toContain("tasa_iva_aplicada numeric DEFAULT 0.16,");
    expect(table).toContain("CONSTRAINT pcc_tasa_iva_presente_chk CHECK");
    expect(table).toContain("NOT (tipo_iva IS DISTINCT FROM 'no_objeto'::text)");
    expect(table).toContain("CONSTRAINT pcc_tipo_iva_chk CHECK");
  });

  it.each(["MXN", "USD"])("keeps SAT 01 without IVA transfer alongside all other fiscal treatments in %s", (moneda) => {
    // Exact fiscal/amount shapes asserted after actual SQL conversion by the SQL fixture.
    const converted = [
      { tipo_iva: "no_objeto" as const, tasa_iva_aplicada: null },
      { tipo_iva: "exento" as const, tasa_iva_aplicada: null },
      { tipo_iva: "tasa_0" as const, tasa_iva_aplicada: 0 },
      { tipo_iva: "gravado_16" as const, tasa_iva_aplicada: 0.16 },
      { tipo_iva: "gravado_8" as const, tasa_iva_aplicada: 0.08 },
    ];
    const context: FacturaContext = {
      forma_pago: "03", metodo_pago: "PUE", uso_cfdi: "G03", moneda, tipo_cambio: 18,
      receptor: { legal_name: "Synthetic fiscal client", tax_id: "AAA010101AAA",
        tax_system: "601", address: { zip: "06600" } },
      conceptos: converted.map((line) => ({
        descripcion: "Same service", cantidad: 3, precio_unitario: 100,
        clave_sat: "78101800", clave_unidad: "E48", tipo_iva: tipoIvaEfectivo(line),
        tasa_iva: line.tasa_iva_aplicada,
      })),
    };
    const products = buildFacturapiPayload(context).items.map((item) => item.product);
    expect(objetoImpDeTipoIva(tipoIvaEfectivo(converted[0]))).toBe("01");
    expect(products[0].taxability).toBe("01");
    expect(products[0].taxes).toEqual([]);
    expect(products[1].taxes).toEqual([{ type: "IVA", rate: 0, factor: "Exento" }]);
    expect(products[2].taxes).toEqual([{ type: "IVA", rate: 0, factor: "Tasa" }]);
    expect(products[3].taxes).toEqual([{ type: "IVA", rate: 0.16, factor: "Tasa" }]);
    expect(products[4].taxes).toEqual([{ type: "IVA", rate: 0.08, factor: "Tasa" }]);
    expect(converted.slice(1).map((line) => objetoImpDeTipoIva(tipoIvaEfectivo(line))))
      .toEqual(["02", "02", "02", "02"]);
  });
});
