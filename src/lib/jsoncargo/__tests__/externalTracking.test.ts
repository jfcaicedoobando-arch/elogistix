import { describe, it, expect } from "vitest";
import { getExternalTracking } from "@/lib/jsoncargo/externalTracking";

describe("getExternalTracking", () => {
  it("retorna URL oficial de Wan Hai cuando la naviera coincide", () => {
    const r = getExternalTracking("WHLC", "WHLU1234567", null);
    expect(r?.url).toContain("wanhai.com");
    expect(r?.label).toContain("Wan Hai");
    expect(r?.generic).toBeUndefined();
  });

  it("soporta match por inclusión (ej. 'WHLC - Wan Hai Lines')", () => {
    const r = getExternalTracking("WHLC - Wan Hai Lines", "WHLU1234567", null);
    expect(r?.url).toContain("wanhai.com");
  });

  it("usa BL cuando no hay contenedor (SITC)", () => {
    const r = getExternalTracking("SITC", null, "SITGZHCM12345");
    expect(r?.url).toContain("SITGZHCM12345");
  });

  it("usa contenedor cuando no hay BL (ANL/CMA)", () => {
    const r = getExternalTracking("ANL", "ANLU1234567", null);
    expect(r?.url).toContain("ANLU1234567");
    expect(r?.url).toContain("cma-cgm.com");
  });

  it("URL-encoded para valores con caracteres especiales", () => {
    const r = getExternalTracking("KMTC", null, "BL/123 XX");
    expect(r?.url).toContain("BL%2F123%20XX");
  });

  it("naviera desconocida pero contenedor disponible → fallback track-trace genérico", () => {
    const r = getExternalTracking("UnaNavieraRara", "ABCD1234567", null);
    expect(r?.generic).toBe(true);
    expect(r?.url).toContain("track-trace.com");
  });

  it("retorna null si no hay ninguno", () => {
    expect(getExternalTracking(null, null, null)).toBeNull();
    expect(getExternalTracking("XXX", null, null)).toBeNull();
  });

  it("normaliza nombre ignorando case/símbolos", () => {
    const a = getExternalTracking("kmtc", "X", null);
    const b = getExternalTracking("K-M-T-C", "X", null);
    expect(a?.url).toBe(b?.url);
  });
});
