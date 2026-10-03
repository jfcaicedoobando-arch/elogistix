import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useVendedorasEmailWarning } from "../useVendedorasEmailWarning";
const { warning } = vi.hoisted(() => ({ warning: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: warning }));

describe("Aviso de identidad de vendedoras", () => {
  it("no atribuye nombres vacíos ni emails privados a un fallo de auth", () => {
    renderHook(() => useVendedorasEmailWarning([{ estadoIdentidad: "sin_nombre" }, { estadoIdentidad: "resuelta" }]));
    expect(warning).not.toHaveBeenCalled();
  });
  it("avisa una vez ante un error de consulta", () => {
    const { rerender } = renderHook(() => useVendedorasEmailWarning([{ estadoIdentidad: "error_consulta" }]));
    rerender();
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0][1].description).toMatch(/Reintenta la consulta/);
  });
});
