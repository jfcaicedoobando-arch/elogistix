import { describe, it, expect } from "vitest";
import {
  extractPrefix,
  validatePrefixMatchesNaviera,
  carrierLabel,
} from "@/lib/jsoncargo/containerPrefixes";

describe("extractPrefix", () => {
  it("extrae las primeras 4 letras en mayúsculas", () => {
    expect(extractPrefix("maeu1234567")).toBe("MAEU");
    expect(extractPrefix(" MSCU9999999 ")).toBe("MSCU");
  });
  it("retorna null si no hay 4 letras iniciales", () => {
    expect(extractPrefix("123MAEU")).toBeNull();
    expect(extractPrefix("")).toBeNull();
    expect(extractPrefix(null)).toBeNull();
    expect(extractPrefix(undefined)).toBeNull();
  });
});

describe("validatePrefixMatchesNaviera", () => {
  it("válido cuando el prefix está mapeado a la naviera", () => {
    const r = validatePrefixMatchesNaviera("MAEU1234567", "MAERSK");
    expect(r.valid).toBe(true);
    expect(r.known).toBe(true);
    expect(r.suggestions).toEqual([]);
  });
  it("inválido cuando prefix conocido NO corresponde a la naviera", () => {
    const r = validatePrefixMatchesNaviera("MAEU1234567", "MSC");
    expect(r.valid).toBe(false);
    expect(r.suggestions).toContain("MAERSK");
  });
  it("válido (no bloquea) cuando prefix desconocido", () => {
    const r = validatePrefixMatchesNaviera("XXXX1234567", "MAERSK");
    expect(r.valid).toBe(true);
    expect(r.known).toBe(false);
  });
  it("válido sin contenedor", () => {
    const r = validatePrefixMatchesNaviera(null, "MAERSK");
    expect(r.valid).toBe(true);
    expect(r.prefix).toBeNull();
  });
  it("leasing pool acepta cualquier naviera soportada", () => {
    expect(validatePrefixMatchesNaviera("TEMU1234567", "MSC").valid).toBe(true);
    expect(validatePrefixMatchesNaviera("TEMU1234567", "MAERSK").valid).toBe(true);
  });
});

describe("carrierLabel", () => {
  it("devuelve la etiqueta legible", () => {
    expect(carrierLabel("MAERSK")).toBe("Maersk");
    expect(carrierLabel("ONE")).toContain("ONE");
  });
});
