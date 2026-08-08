import { describe, it, expect } from "vitest";
import {
  bucketDeDias,
  CUBETAS_AGING,
  CUBETA_LABELS,
  CUBETA_TONO_KPI,
  monedasPresentes,
} from "../buckets";

describe("bucketDeDias", () => {
  it("clasifica los límites exactos de cada cubeta", () => {
    expect(bucketDeDias(-10)).toBe("vigente");
    expect(bucketDeDias(0)).toBe("vigente");
    expect(bucketDeDias(1)).toBe("d_1_30");
    expect(bucketDeDias(30)).toBe("d_1_30");
    expect(bucketDeDias(31)).toBe("d_31_60");
    expect(bucketDeDias(60)).toBe("d_31_60");
    expect(bucketDeDias(61)).toBe("d_61_90");
    expect(bucketDeDias(90)).toBe("d_61_90");
    expect(bucketDeDias(91)).toBe("mas_90");
  });
});

describe("catálogos de cubetas", () => {
  it("tiene etiqueta y tono para las 5 cubetas", () => {
    expect(CUBETAS_AGING).toHaveLength(5);
    for (const b of CUBETAS_AGING) {
      expect(CUBETA_LABELS[b]).toBeTruthy();
      expect(CUBETA_TONO_KPI[b]).toBeTruthy();
    }
  });
});

describe("monedasPresentes", () => {
  it("ordena MXN, USD, EUR primero y el resto alfabético", () => {
    const rows = [{ moneda: "cad" }, { moneda: "USD" }, { moneda: "MXN" }, { moneda: "USD" }];
    expect(monedasPresentes(rows)).toEqual(["MXN", "USD", "CAD"]);
  });

  it("tolera lista vacía", () => {
    expect(monedasPresentes([])).toEqual([]);
  });
});
