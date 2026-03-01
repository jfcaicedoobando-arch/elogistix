import { describe, it, expect } from "vitest";
import { ports } from "@/data/ports";

describe("ports", () => {
  it("no está vacío", () => {
    expect(ports.length).toBeGreaterThan(0);
  });
  it("códigos son únicos", () => {
    const codes = ports.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("incluye puertos mexicanos clave", () => {
    const mx = ports.filter((p) => p.country === "México");
    const nombres = mx.map((p) => p.name);
    expect(nombres).toContain("Manzanillo");
    expect(nombres).toContain("Veracruz");
  });
  it("cada puerto tiene code, name y country", () => {
    ports.forEach((p) => {
      expect(p.code).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.country).toBeTruthy();
    });
  });
});
