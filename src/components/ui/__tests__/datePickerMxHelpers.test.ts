import { describe, it, expect } from "vitest";
import { parseFlexible, parseDisplay, applyMask } from "@/components/ui/date-picker-mx-helpers";

describe("parseFlexible", () => {
  it("ISO YYYY-MM-DD", () => {
    expect(parseFlexible("2026-07-07")).toBe("2026-07-07");
    expect(parseFlexible("2026/07/07")).toBe("2026-07-07");
  });
  it("DD/MM/YYYY con distintos separadores", () => {
    expect(parseFlexible("07/07/2026")).toBe("2026-07-07");
    expect(parseFlexible("7/7/2026")).toBe("2026-07-07");
    expect(parseFlexible("07-07-2026")).toBe("2026-07-07");
    expect(parseFlexible("07.07.2026")).toBe("2026-07-07");
  });
  it("Español: DD de MES de YYYY", () => {
    expect(parseFlexible("7 de julio de 2026")).toBe("2026-07-07");
    expect(parseFlexible("07 julio 2026")).toBe("2026-07-07");
    expect(parseFlexible("7 jul 2026")).toBe("2026-07-07");
    expect(parseFlexible("7 de diciembre de 2026")).toBe("2026-12-07");
  });
  it("Inválidos", () => {
    expect(parseFlexible("")).toBeNull();
    expect(parseFlexible("foobar")).toBeNull();
    expect(parseFlexible("32/13/2026")).toBeNull();
    expect(parseFlexible("2026-13-40")).toBeNull();
  });
  it("parseDisplay estricto no cambia", () => {
    expect(parseDisplay("07/07/2026")).toBe("2026-07-07");
    expect(parseDisplay("2026-07-07")).toBeNull();
  });
  it("applyMask sigue removiendo separadores", () => {
    expect(applyMask("07/07/2026")).toBe("07/07/2026");
  });
});
