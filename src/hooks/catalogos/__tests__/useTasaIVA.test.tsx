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

  it("aplica fallback cuando la configuración no expone tasa_iva", async () => {
    const { useConfigValue } = await import("@/hooks/configuracion/useConfiguracion");
    (useConfigValue as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_mod: unknown, _key: unknown, def: unknown) => def,
    );
    const { result } = renderHook(() => useTasaIVA());
    // Default contractual: 16% → 0.16
    expect(result.current).toBe(0.16);
  });
});
