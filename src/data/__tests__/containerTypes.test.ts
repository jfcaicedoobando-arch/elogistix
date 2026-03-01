import { describe, it, expect } from "vitest";
import { containerTypes } from "@/data/containerTypes";

describe("containerTypes", () => {
  it("no está vacío", () => {
    expect(containerTypes.length).toBeGreaterThan(0);
  });
  it("todos tienen code y name", () => {
    containerTypes.forEach((ct) => {
      expect(ct.code).toBeTruthy();
      expect(ct.name).toBeTruthy();
    });
  });
  it("códigos son únicos", () => {
    const codes = containerTypes.map((ct) => ct.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
