import { describe, it, expect } from "vitest";
import { getFieldLabel } from "../fieldLabels";

describe("getFieldLabel", () => {
  it("resuelve etiquetas catalogadas", () => {
    expect(getFieldLabel("descripcion_mercancia")).toBe("Descripción de la mercancía");
    expect(getFieldLabel("rfc")).toBe("RFC");
  });

  it("usa el último segmento de rutas anidadas ignorando índices numéricos", () => {
    expect(getFieldLabel("conceptos_venta.0.cantidad")).toBe("Cantidad");
  });

  it("humaniza campos no catalogados en snake_case", () => {
    expect(getFieldLabel("campo_totalmente_nuevo")).toBe("Campo totalmente nuevo");
  });
});
