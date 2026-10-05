import { describe, expect, it } from "vitest";
import { addDaysIso } from "@/lib/date/dateOnly";
import { bucketDeDias } from "../buckets";
import { clasificarAFecha, cubetaDesdeFiltro, describirFiltrosAging } from "../reportScope";

describe("fecha de referencia del Aging CxC/CxP", () => {
  it.each([
    [-1, "vigente"], [0, "vigente"], [1, "d_1_30"], [30, "d_1_30"],
    [31, "d_31_60"], [60, "d_31_60"], [61, "d_61_90"], [90, "d_61_90"], [91, "mas_90"],
  ])("clasifica %i días en %s con los límites del resumen SQL", (dias, cubeta) => {
    const factura = { fecha_emision: "2026-01-01", fecha_vencimiento: addDaysIso("2026-11-04", -dias), dias_vencido: 0, saldo: 58 };
    const [row] = clasificarAFecha([factura], "2026-11-04");
    expect(row.dias_vencido).toBe(dias);
    expect(bucketDeDias(row.dias_vencido)).toBe(cubeta);
    expect(row.saldo).toBe(58);
    expect(factura.dias_vencido).toBe(0);
  });

  it("usa emisión cuando el proveedor no tiene vencimiento, igual que las RPC", () => {
    const [row] = clasificarAFecha([{ fecha_emision: "2026-10-04", fecha_vencimiento: null, dias_vencido: 0 }], "2026-11-04");
    expect(row.dias_vencido).toBe(31);
  });

  it("comparte la selección de cubeta del resumen con su drill-down", () => {
    expect(cubetaDesdeFiltro("31_60")).toBe("d_31_60");
    expect(cubetaDesdeFiltro("mas_90")).toBe("mas_90");
    expect(cubetaDesdeFiltro("todas")).toBe("todas");
    expect(describirFiltrosAging({ search: 'Cliente "A", norte', cubeta: "31_60" })).toBe('Con saldo en 31-60 días; Búsqueda: Cliente "A", norte');
  });
});
