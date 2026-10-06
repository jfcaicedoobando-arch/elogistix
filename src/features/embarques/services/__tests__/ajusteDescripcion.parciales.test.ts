import { describe, expect, it } from "vitest";
import { describirAjuste, describirAjusteNeto } from "../../components/costos/ajusteDescripcion";

describe("AUD123 · parcialidades no se rotulan como ahorro", () => {
  it.each([60, 40])("facturado %s conserva pendiente contra presupuesto100", (facturado) => {
    const descripcion = describirAjuste(100, facturado, "MXN", { tieneFactura: true });
    expect(descripcion).toMatchObject({ kind: "pendiente_facturar", tone: "warning", monto: 100 - facturado });
    expect(descripcion.titulo).toContain("Pendiente de facturar");
    expect(descripcion.detalle).toContain("sólo un ajuste explícito");
    expect(describirAjusteNeto(100, facturado, "MXN").kind).toBe("pendiente_facturar");
  });
  it("segunda parcialidad40 completa100 sin ahorro ni pendiente", () => {
    expect(describirAjusteNeto(100, 60 + 40, "MXN").kind).toBe("sin_ajuste");
  });
  it("un presupuesto explícitamente reducido a60 concilia con factura60", () => {
    expect(describirAjusteNeto(100 - 40, 60, "MXN").kind).toBe("sin_ajuste");
    expect(describirAjusteNeto(100, 120, "MXN").kind).toBe("sobrecosto");
  });
});
