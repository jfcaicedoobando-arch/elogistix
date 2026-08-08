/**
 * Test del helper puro `bucketDeDias` del drill-down de aging (Ola B · B1).
 */
import { describe, it, expect } from "vitest";
import { bucketDeDias } from "../agingBuckets";

describe("bucketDeDias — reexport de CxP (agingBuckets)", () => {
  it("clasifica días vigentes (≤0) como vigente", () => {
    expect(bucketDeDias(0)).toBe("vigente");
    expect(bucketDeDias(-5)).toBe("vigente");
  });

  it("1-30 días", () => {
    expect(bucketDeDias(1)).toBe("d_1_30");
    expect(bucketDeDias(30)).toBe("d_1_30");
  });

  it("31-60 días", () => {
    expect(bucketDeDias(31)).toBe("d_31_60");
    expect(bucketDeDias(60)).toBe("d_31_60");
  });

  it("61-90 días", () => {
    expect(bucketDeDias(61)).toBe("d_61_90");
    expect(bucketDeDias(90)).toBe("d_61_90");
  });

  it(">90 días", () => {
    expect(bucketDeDias(91)).toBe("mas_90");
    expect(bucketDeDias(365)).toBe("mas_90");
  });
});
