import { describe, it, expect } from "vitest";
import { montoAnalitica } from "@/features/crm/routes/analiticaMonto";

describe("montoAnalitica (tablas /crm/analitica)", () => {
  it("omite el código de moneda en el texto visible (la columna Moneda ya lo indica)", () => {
    const { texto } = montoAnalitica(37_500, "MXN");
    expect(texto).not.toMatch(/MXN/);
    expect(texto.length).toBeLessThanOrEqual(8);
  });

  it("conserva el valor completo con moneda para tooltip y lectores de pantalla", () => {
    expect(montoAnalitica(37_500, "MXN").titulo).toContain("MXN");
    expect(montoAnalitica(37_500, "MXN").titulo).toContain("37,500");
  });

  it("no mezcla monedas: USD conserva su propio código en el título", () => {
    const usd = montoAnalitica(1_234, "USD");
    expect(usd.titulo).toContain("USD");
    expect(usd.texto).not.toMatch(/USD|MXN/);
  });

  it("maneja cero y valores no finitos sin romper", () => {
    expect(montoAnalitica(0, "MXN").texto).toBe("0");
    expect(montoAnalitica(Number.NaN, "MXN").texto).toBe("0");
  });
});
