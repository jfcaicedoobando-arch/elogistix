import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useTasaIVA } from "../useTasaIVA";

vi.mock("@/hooks/configuracion/useConfiguracion", () => ({
  useConfigValue: vi.fn(() => 16),
}));

describe("useTasaIVA", () => {
  it("returns the IVA rate as a decimal", () => {
    const { result } = renderHook(() => useTasaIVA());
    
    expect(result.current).toBe(0.16);
  });
});
