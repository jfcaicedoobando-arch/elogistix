import { describe, expect, it } from "vitest";
import { topChartHeightClass } from "../topChartHeight";

describe("topChartHeight", () => {
  it("mantiene compacta una sola barra", () => {
    expect(topChartHeightClass(1)).toBe("h-56");
  });

  it("crece con los resultados sin superar el alto actual", () => {
    expect(topChartHeightClass(5)).toBe("h-64");
    expect(topChartHeightClass(10)).toBe("h-[350px]");
  });
});