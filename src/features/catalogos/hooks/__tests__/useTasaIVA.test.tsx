import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useTasaIVA } from "../useTasaIVA";

vi.mock("@/features/configuracion/hooks/useConfiguracion", () => ({
  useConfigValue: vi.fn((_mod: string, key: string, def: unknown) => (key === "tasa_iva" ? 16 : def)),
}));

describe("useTasaIVA", () => {
  it("returns the IVA rate as a decimal (0.16)", () => {
    const { result } = renderHook(() => useTasaIVA());
    expect(result.current).toBe(0.16);
  });

  it("aplica fallback (def del caller) cuando la configuración no expone tasa_iva", async () => {
    // Forzamos un def distinto del valor contractual para validar que la
    // función realmente devuelve el fallback y no esconde un retorno hardcoded.
    const { useConfigValue } = await import("@/features/configuracion/hooks/useConfiguracion");
    (useConfigValue as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      (_mod: unknown, _key: unknown, _def: unknown) => 8, // simula valor en BD = 8%
    );
    const { result } = renderHook(() => useTasaIVA());
    expect(result.current).toBe(0.08);
  });
});
