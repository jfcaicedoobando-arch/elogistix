import { describe, it, expect } from "vitest";
import { getErrorMessage, translateLcCode, stripLcCode } from "@/lib/errors";

describe("lcCodes", () => {
  it("traduce códigos LC_ conocidos", () => {
    expect(translateLcCode("LC_TRANSICION_INVALIDA: estado x")).toMatch(/otra sesión/);
    expect(translateLcCode("PGRST: LC_CXP_DESCUADRE detalle")).toMatch(/no cuadran/);
    expect(translateLcCode("LC_NO_EXISTE_XYZ")).toBeNull();
  });

  it("stripLcCode limpia tokens LC_*", () => {
    expect(stripLcCode("LC_FOO_BAR: mensaje humano")).toBe("mensaje humano");
    expect(stripLcCode("sin código")).toBe("sin código");
  });

  it("getErrorMessage prioriza legacy y luego catálogo LC", () => {
    expect(getErrorMessage(new Error("factura_inmutable"))).toMatch(/nota de crédito/i);
    expect(getErrorMessage(new Error("LC_AUTH_REQUIRED"))).toMatch(/iniciar sesión/i);
    expect(getErrorMessage(new Error("LC_DESCONOCIDO: detalle libre"))).toBe("detalle libre");
    expect(getErrorMessage(new Error("otro error"))).toBe("otro error");
  });
});
