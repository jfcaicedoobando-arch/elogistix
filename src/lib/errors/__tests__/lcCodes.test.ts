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

  it("explica la cronología del anticipo en errores estándar y PostgREST", () => {
    const raw = "LC_ANTICIPO_APLICACION_FECHA: detalle interno";
    const friendly = "Indica una fecha de aplicación igual o posterior a la entrega del anticipo y a la emisión de la factura.";
    expect(translateLcCode(raw)).toBe(friendly);
    expect(getErrorMessage(new Error(raw))).toBe(friendly);
    expect(getErrorMessage({ code: "22023", message: raw })).toBe(friendly);
  });

  it.each([
    ["LC_ANTICIPO_MEDIO_DEVOLUCION", "Selecciona si recibiste la devolución en efectivo o por depósito bancario."],
    ["LC_ANTICIPO_EFECTIVO_CON_CUENTA", "La devolución en efectivo no lleva cuenta bancaria."],
  ])("explica %s sin detalles técnicos", (code, friendly) => {
    const raw = `${code}: detalle interno`;
    expect(translateLcCode(raw)).toBe(friendly);
    expect(getErrorMessage(new Error(raw))).toBe(friendly);
    expect(getErrorMessage({ code: "22023", message: raw })).toBe(friendly);
  });

  it("stripLcCode limpia tokens LC_*", () => {
    expect(stripLcCode("LC_FOO_BAR: mensaje humano")).toBe("mensaje humano");
    expect(stripLcCode("sin código")).toBe("sin código");
  });

  it("explica el rechazo de la factura de una póliza sin exponer detalles internos", () => {
    const raw = "LC_SEGURO_FACTURA_INVALIDA: detalle interno";
    const friendly = "La factura no está vigente, no pertenece a tu organización o no corresponde a este embarque. Selecciona una factura válida para ligar la póliza.";
    expect(translateLcCode(raw)).toBe(friendly);
    expect(getErrorMessage(new Error(raw))).toBe(friendly);
    // Conserva la prioridad existente de SQLSTATE 23514 en errores PostgREST.
    expect(getErrorMessage({ code: "23514", message: raw })).toMatch(/regla de validación del sistema/);
  });

  it("getErrorMessage prioriza legacy y luego catálogo LC", () => {
    expect(getErrorMessage(new Error("factura_inmutable"))).toMatch(/nota de crédito/i);
    expect(getErrorMessage(new Error("LC_AUTH_REQUIRED"))).toMatch(/iniciar sesión/i);
    expect(getErrorMessage(new Error("LC_DESCONOCIDO: detalle libre"))).toBe("detalle libre");
    expect(getErrorMessage(new Error("otro error"))).toBe("otro error");
  });
});
