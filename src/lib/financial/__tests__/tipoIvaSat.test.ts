import { describe, it, expect } from "vitest";
import {
  TIPO_IVA_OPCIONES,
  TIPO_IVA_LABEL_SAT,
  esNoObjetoIva,
  esTipoIvaSat,
  tasaDeTipoIva,
  tasaParaTotales,
  tasaDefaultCatalogo,
  objetoImpDeTipoIva,
  tipoIvaDesdeLegacy,
  tipoIvaEfectivo,
} from "@/lib/financial/tipoIvaSat";

describe("tipoIvaSat — No objeto de impuesto (SAT 01)", () => {
  it("expone la opción con etiqueta clara y distinta de Exento", () => {
    const opciones = TIPO_IVA_OPCIONES.map((o) => o.value);
    expect(opciones).toContain("no_objeto");
    expect(TIPO_IVA_LABEL_SAT.no_objeto).toBe("No objeto de impuesto (SAT 01)");
    expect(TIPO_IVA_LABEL_SAT.no_objeto).not.toBe(TIPO_IVA_LABEL_SAT.exento);
  });

  it("no causa IVA ni tasa de traslado", () => {
    expect(esNoObjetoIva("no_objeto")).toBe(true);
    expect(esNoObjetoIva("exento")).toBe(false);
    expect(tasaDeTipoIva("no_objeto")).toBeNull();
    expect(tasaParaTotales("no_objeto")).toBe(0);
    expect(tasaDefaultCatalogo("no_objeto")).toBeNull();
  });

  it("mapea a ObjetoImp 01 y el resto a 02", () => {
    expect(objetoImpDeTipoIva("no_objeto")).toBe("01");
    expect(objetoImpDeTipoIva("exento")).toBe("02");
    expect(objetoImpDeTipoIva("tasa_0")).toBe("02");
    expect(objetoImpDeTipoIva("gravado_16")).toBe("02");
  });

  it("nunca se infiere desde datos legacy (IVA 0 no es no objeto)", () => {
    expect(tipoIvaDesdeLegacy(false, 0)).not.toBe("no_objeto");
    expect(tipoIvaDesdeLegacy(true, 0)).not.toBe("no_objeto");
    expect(tipoIvaDesdeLegacy(false, null)).toBe("exento");
  });

  it("el tipo explícito manda sobre el legacy", () => {
    expect(tipoIvaEfectivo({ tipo_iva: "no_objeto", aplica_iva: true, tasa_iva_aplicada: 0.16 })).toBe("no_objeto");
    expect(tipoIvaEfectivo({ aplica_iva: true, tasa_iva_aplicada: 0.08 })).toBe("gravado_8");
  });

  it("no altera gravado 16/8 ni tasa 0", () => {
    expect(tasaDeTipoIva("gravado_16")).toBe(0.16);
    expect(tasaDeTipoIva("gravado_8")).toBe(0.08);
    expect(tasaDeTipoIva("tasa_0")).toBe(0);
    expect(tasaDeTipoIva("exento")).toBeNull();
    expect(esTipoIvaSat("otro")).toBe(false);
  });
});
