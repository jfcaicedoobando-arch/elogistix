import { describe, it, expect } from "vitest";
import { getErrorMessage } from "@/lib/errors";

describe("errors/index · getErrorMessage · primitivos", () => {
  it("devuelve mensaje de Error estándar", () => {
    expect(getErrorMessage(new Error("algo salió mal"))).toBe("algo salió mal");
  });

  it("devuelve 'Error desconocido' cuando el Error tiene message vacío", () => {
    const e = new Error("");
    expect(getErrorMessage(e)).toBe("Error desconocido");
  });

  it("devuelve la cadena directamente cuando err es string", () => {
    expect(getErrorMessage("string de error")).toBe("string de error");
  });

  it("devuelve 'Error desconocido' para null", () => {
    expect(getErrorMessage(null)).toBe("Error desconocido");
  });

  it("devuelve 'Error desconocido' para undefined", () => {
    expect(getErrorMessage(undefined)).toBe("Error desconocido");
  });

  it("devuelve 'Error desconocido' para número", () => {
    expect(getErrorMessage(42)).toBe("Error desconocido");
  });
});

describe("errors/index · getErrorMessage · objeto estilo PostgrestError", () => {
  it("extrae message del objeto", () => {
    expect(getErrorMessage({ message: "violación de restricción" })).toBe(
      "violación de restricción",
    );
  });

  it("concatena message y details con ' — '", () => {
    expect(getErrorMessage({ message: "error base", details: "detalle extra" })).toBe(
      "error base — detalle extra",
    );
  });

  it("incluye hint si está presente", () => {
    expect(getErrorMessage({ message: "error", details: "det", hint: "pista" })).toBe(
      "error — det — pista",
    );
  });

  it("usa code si message/details/hint son vacíos", () => {
    expect(getErrorMessage({ code: "P0001" })).toBe("Código P0001");
  });

  it("devuelve 'Error desconocido' para objeto vacío", () => {
    expect(getErrorMessage({})).toBe("Error desconocido");
  });
});

describe("errors/index · getErrorMessage · mensajes amigables (factura_inmutable)", () => {
  it("traduce error con código factura_inmutable en message de Error", () => {
    const traduccion =
      "Esta factura ya fue emitida y no puede modificarse. Para corregirla, emite una nota de crédito.";
    expect(getErrorMessage(new Error("factura_inmutable"))).toBe(traduccion);
  });

  it("traduce sin importar mayúsculas (regex /i)", () => {
    const traduccion =
      "Esta factura ya fue emitida y no puede modificarse. Para corregirla, emite una nota de crédito.";
    expect(getErrorMessage(new Error("FACTURA_INMUTABLE: snapshot"))).toBe(traduccion);
  });

  it("traduce cuando viene en objeto plano", () => {
    const traduccion =
      "Esta factura ya fue emitida y no puede modificarse. Para corregirla, emite una nota de crédito.";
    expect(getErrorMessage({ message: "factura_inmutable" })).toBe(traduccion);
  });

  it("NO traduce un mensaje sin la firma", () => {
    const raw = "Error genérico sin firma especial";
    expect(getErrorMessage(new Error(raw))).toBe(raw);
  });
});
