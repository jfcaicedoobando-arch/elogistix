import { describe, it, expect } from "vitest";
import { shippingLines } from "@/data/shippingLines";

describe("shippingLines", () => {
  it("no está vacío", () => {
    expect(shippingLines.length).toBeGreaterThan(0);
  });
  it("códigos son únicos", () => {
    const codes = shippingLines.map((sl) => sl.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
  it("cada línea tiene code y name", () => {
    shippingLines.forEach((sl) => {
      expect(sl.code).toBeTruthy();
      expect(sl.name).toBeTruthy();
    });
  });
});
