import { describe, expect, it } from "vitest";
import { topChartHeight } from "../topChartHeight";

describe("topChartHeight", () => {
  it("mantiene compacta una sola barra", () => {
    expect(topChartHeight(1)).toBe(220);
  });

  it("crece con los resultados sin superar el alto actual", () => {
    expect(topChartHeight(5)).toBe(232);
    expect(topChartHeight(10)).toBe(350);
  });
});