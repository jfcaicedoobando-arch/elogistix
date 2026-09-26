import { describe, expect, it } from "vitest";
import { formatCurrency } from "@/lib/formatters";
import { buildKpisProforma } from "../proformaKpis";

const mixtos = {
  subtotal_usd: 4200, iva_usd: 0, total_usd: 4200,
  subtotal_mxn: 7200, iva_mxn: 1152, total_mxn: 8352,
};

describe("proformaKpis — importes en moneda original", () => {
  it("muestra subtotal, IVA y total MXN además de USD sin homologarlos", () => {
    const kpis = buildKpisProforma({ totales: mixtos, facturada: false });
    expect(kpis.slice(0, 3)).toEqual([
      { label: "Total", value: formatCurrency(4200, "USD"), hint: `+ ${formatCurrency(8352, "MXN")}` },
      { label: "Subtotal", value: formatCurrency(4200, "USD"), hint: `+ ${formatCurrency(7200, "MXN")}` },
      { label: "IVA", value: formatCurrency(0, "USD"), hint: `+ ${formatCurrency(1152, "MXN")}` },
    ]);
  });

  it.each(["MXN", "USD"] as const)("no repite desgloses en una proforma sólo %s", moneda => {
    const totales = { ...mixtos };
    if (moneda === "MXN") {
      totales.subtotal_usd = totales.iva_usd = totales.total_usd = 0;
    } else {
      totales.subtotal_mxn = totales.iva_mxn = totales.total_mxn = 0;
    }
    const kpis = buildKpisProforma({ totales, facturada: false });
    expect(kpis.slice(0, 3).every(kpi => kpi.value.startsWith(moneda) && !kpi.hint)).toBe(true);
  });
});
