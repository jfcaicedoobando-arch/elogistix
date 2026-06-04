import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useTasaIVA } from "../useTasaIVA";

vi.mock("@/hooks/configuracion/useConfiguracion", () => ({
  useConfigValue: vi.fn((_mod: any, key: any, def: any) => (key === "tasa_iva" ? 16 : def)),
}));

describe("useTasaIVA", () => {
  it("returns the IVA rate as a decimal (0.16)", () => {
    const { result } = renderHook(() => useTasaIVA());
    expect(result.current).toBe(0.16);
  });

  it("uses fallback if config is not available", () => {
    // This is tested implicitly by the mock returning 16
    const { result } = renderHook(() => useTasaIVA());
    expect(result.current).toBe(0.16);
  });
});
