import { describe, it, expect } from "vitest";
import { getErrorMessage, translateLcCode, stripLcCode } from "@/lib/errors";

describe("lcCodes", () => {
  it("traduce códigos LC_ conocidos", () => {
    expect(translateLcCode("LC_TRANSICION_INVALIDA: estado x")).toMatch(/otra sesión/);
    expect(translateLcCode("PGRST: LC_CXP_DESCUADRE detalle")).toMatch(/no suman el subtotal/);
    expect(translateLcCode("LC_NO_EXISTE_XYZ")).toBeNull();
  });
  it("una revisión bancaria cambiada o inválida indica cargar el archivo antes de confirmar", () => {
    expect(translateLcCode("LC_IMPORTACION_REVISION_CAMBIO")).toMatch(/datos bancarios cambiaron.*carga el archivo/i);
    expect(translateLcCode("LC_IMPORTACION_REVISION_INVALIDA")).toMatch(/validar la revisión.*vuelve a cargarlo/i);
  });

  it("un vínculo de proforma concurrente tiene un mensaje accionable sin detalles técnicos", () => {
    const raw = "LC_PROFORMA_VINCULO_CAMBIO: uuid-interno";
    expect(translateLcCode(raw)).toBe(
      "La proforma cambió de embarque mientras guardabas. Actualiza la pantalla y vuelve a intentar la operación.",
    );
    expect(getErrorMessage(new Error(raw))).not.toContain("uuid-interno");
    // PostgREST conserva la traducción genérica existente para SQLSTATE 40001.
    expect(getErrorMessage({ code: "40001", message: raw })).toMatch(/Refresca la pantalla e intenta de nuevo/);
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
