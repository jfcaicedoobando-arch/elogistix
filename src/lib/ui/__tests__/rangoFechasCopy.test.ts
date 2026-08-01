import { describe, it, expect } from "vitest";
import {
  RANGO_DESDE_LABEL,
  RANGO_HASTA_LABEL,
  RANGO_PREFIJOS,
  rangoLabel,
} from "../rangoFechasCopy";

describe("rangoLabel", () => {
  it("devuelve el copy base sin prefijo", () => {
    expect(rangoLabel(null, "desde")).toBe("Desde");
    expect(rangoLabel(null, "hasta")).toBe("Hasta");
  });

  it("antepone el prefijo y usa minúscula en el extremo", () => {
    expect(rangoLabel("Emisión", "desde")).toBe("Emisión desde");
    expect(rangoLabel("Vencimiento", "hasta")).toBe("Vencimiento hasta");
    expect(rangoLabel("ETD", "desde")).toBe("ETD desde");
  });

  it("expone constantes capitalizadas", () => {
    expect(RANGO_DESDE_LABEL).toBe("Desde");
    expect(RANGO_HASTA_LABEL).toBe("Hasta");
  });

  it("genera copy válido para todos los prefijos canónicos", () => {
    for (const prefijo of RANGO_PREFIJOS) {
      expect(rangoLabel(prefijo, "desde")).toBe(`${prefijo} desde`);
      expect(rangoLabel(prefijo, "hasta")).toBe(`${prefijo} hasta`);
    }
  });
});
