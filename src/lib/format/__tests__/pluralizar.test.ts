import { describe, it, expect } from "vitest";
import { pluralizar } from "@/lib/format/pluralizar";

describe("pluralizar", () => {
  it("usa singular con 1", () => {
    expect(pluralizar(1, "embarque")).toBe("1 embarque");
  });

  it("usa plural regular con 0 y con N > 1", () => {
    expect(pluralizar(0, "embarque")).toBe("0 embarques");
    expect(pluralizar(2, "embarque")).toBe("2 embarques");
  });

  it("respeta un plural irregular explícito", () => {
    expect(pluralizar(2, "luz", { plural: "luces" })).toBe("2 luces");
    expect(pluralizar(1, "luz", { plural: "luces" })).toBe("1 luz");
  });

  it("permite omitir el número", () => {
    expect(pluralizar(3, "embarque", { includeCount: false })).toBe("embarques");
  });

  it("es defensivo ante valores no finitos", () => {
    expect(pluralizar(NaN, "embarque")).toBe("0 embarques");
  });
});
