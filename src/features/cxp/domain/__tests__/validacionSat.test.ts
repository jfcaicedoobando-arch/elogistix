import { describe, it, expect } from "vitest";
import {
  requiereValidacionSat,
  motivoSatNoAplica,
  esValidableEnSat,
} from "../validacionSat";

describe("requiereValidacionSat", () => {
  it("no aplica para proveedor extranjero (incluso si trae UUID)", () => {
    const f = { proveedor_origen: "Extranjero" as const, uuid_fiscal: "abc", archivo_xml_url: null };
    expect(requiereValidacionSat(f)).toBe(false);
    expect(esValidableEnSat(f)).toBe(false);
    expect(motivoSatNoAplica(f)).toMatch(/extranjero/i);
  });

  it("no aplica para captura manual nacional sin UUID ni XML", () => {
    const f = { proveedor_origen: "Nacional" as const, uuid_fiscal: null, archivo_xml_url: null };
    expect(requiereValidacionSat(f)).toBe(false);
    expect(motivoSatNoAplica(f)).toMatch(/manual/i);
  });

  it("aplica para CFDI nacional con UUID", () => {
    const f = { proveedor_origen: "Nacional" as const, uuid_fiscal: "uuid-1", archivo_xml_url: null };
    expect(requiereValidacionSat(f)).toBe(true);
    expect(esValidableEnSat(f)).toBe(true);
    expect(motivoSatNoAplica(f)).toBeNull();
  });

  it("aplica para CFDI nacional con XML aunque el UUID aún no se haya extraído", () => {
    const f = { proveedor_origen: "Nacional" as const, uuid_fiscal: null, archivo_xml_url: "x.xml" };
    expect(requiereValidacionSat(f)).toBe(true);
    // No es validable todavía: la consulta al SAT necesita el UUID.
    expect(esValidableEnSat(f)).toBe(false);
  });

  it("origen nulo con CFDI se trata como nacional (no se infiere por UUID)", () => {
    expect(requiereValidacionSat({ proveedor_origen: null, uuid_fiscal: "u", archivo_xml_url: null })).toBe(true);
    expect(requiereValidacionSat({ proveedor_origen: null, uuid_fiscal: null, archivo_xml_url: null })).toBe(false);
  });
});
