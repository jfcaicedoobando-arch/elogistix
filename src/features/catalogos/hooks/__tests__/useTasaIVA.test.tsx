import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useTasaIVA } from "../useTasaIVA";

describe("useTasaIVA", () => {
  it("returns the Mexican general IVA rate as a decimal (0.16)", () => {
    const { result } = renderHook(() => useTasaIVA());
    expect(result.current).toBe(0.16);
  });
});
