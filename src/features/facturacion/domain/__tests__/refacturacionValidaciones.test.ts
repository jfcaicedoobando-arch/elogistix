import { describe, it, expect } from "vitest";
import {
  pendientesReceptorFiscal,
  receptorListoParaFacturar,
  bloqueoOrdenante,
  diferenciasImportes,
  avisosMoneda,
} from "../refacturacionValidaciones";
import { esRfcMxValido, normalizarRfc } from "@/lib/validation/rfcMx";

const receptorOk = {
  nombre: "Comercializadora del Norte SA de CV",
  rfc: "CNO120315AB1",
  regimen_fiscal: "601",
  codigo_postal: "64000",
};

describe("rfcMx", () => {
  it("acepta RFC de persona moral y física", () => {
    expect(esRfcMxValido("CNO120315AB1")).toBe(true);
    expect(esRfcMxValido("LOBH850101HX2")).toBe(true);
  });

  it("rechaza formatos inválidos y genéricos nominativos", () => {
    expect(esRfcMxValido("ABC")).toBe(false);
    expect(esRfcMxValido("XAXX010101000")).toBe(true);
    expect(esRfcMxValido("XAXX010101000", { permitirGenerico: false })).toBe(false);
  });

  it("normaliza a mayúsculas", () => {
    expect(normalizarRfc(" cno120315ab1 ")).toBe("CNO120315AB1");
  });
});

describe("pendientesReceptorFiscal", () => {
  it("no reporta faltantes cuando el receptor está completo", () => {
    expect(pendientesReceptorFiscal(receptorOk)).toEqual([]);
    expect(receptorListoParaFacturar(receptorOk)).toBe(true);
  });

  it("detecta RFC genérico y CP inválido", () => {
    const faltan = pendientesReceptorFiscal({
      ...receptorOk,
      rfc: "XAXX010101000",
      codigo_postal: "640",
    });
    expect(faltan).toHaveLength(2);
    expect(faltan.join(" ")).toContain("RFC");
  });

  it("pide todo cuando no hay receptor", () => {
    expect(pendientesReceptorFiscal(null)).toHaveLength(4);
  });
});

describe("bloqueoOrdenante", () => {
  it("exige el nombre de la empresa que pagó", () => {
    expect(bloqueoOrdenante("", "")).toContain("nombre");
  });

  it("acepta nombre sin RFC", () => {
    expect(bloqueoOrdenante("Grupo Pagador SA", "")).toBeNull();
  });

  it("rechaza RFC mal formado", () => {
    expect(bloqueoOrdenante("Grupo Pagador SA", "ABC12")).toContain("RFC");
  });
});

const base = {
  moneda: "MXN",
  tipo_cambio: null,
  subtotal: 1000,
  iva: 160,
  ret_isr: 0,
  ret_iva: 0,
  total: 1160,
};

describe("diferenciasImportes", () => {
  it("no reporta diferencias por redondeo menor a un centavo", () => {
    expect(diferenciasImportes(base, { ...base, total: 1160.004 })).toEqual([]);
  });

  it("reporta impuestos y totales distintos", () => {
    const d = diferenciasImportes(base, { ...base, iva: 0, total: 1000 });
    expect(d.map((x) => x.campo)).toEqual(["IVA trasladado", "Total"]);
  });
});

describe("avisosMoneda", () => {
  it("avisa cuando cambia la moneda", () => {
    expect(avisosMoneda(base, { ...base, moneda: "USD", tipo_cambio: 17.5 })).toHaveLength(1);
  });

  it("avisa si falta tipo de cambio en moneda extranjera", () => {
    const avisos = avisosMoneda({ ...base, moneda: "USD", tipo_cambio: 17.5 }, { ...base, moneda: "USD" });
    expect(avisos.join(" ")).toContain("tipo de cambio");
  });
});
