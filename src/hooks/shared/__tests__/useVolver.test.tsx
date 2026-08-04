import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { useVolver } from "@/hooks/shared/useVolver";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

function wrapperWithEntries(entries: (string | { pathname: string; state?: unknown })[]) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={entries}>{children}</MemoryRouter>;
  };
}

describe("useVolver", () => {
  it("navega al fallback cuando no hay historial interno (entrada única, location.key === 'default')", () => {
    navigateMock.mockClear();
    const { result } = renderHook(() => useVolver("/embarques"), {
      wrapper: wrapperWithEntries(["/embarques/123"]),
    });
    act(() => result.current());
    expect(navigateMock).toHaveBeenCalledWith("/embarques");
  });

  it("usa navigate(-1) cuando hay historial interno (más de una entrada)", () => {
    navigateMock.mockClear();
    const { result } = renderHook(() => useVolver("/embarques"), {
      wrapper: wrapperWithEntries(["/embarques", "/embarques/123"]),
    });
    act(() => result.current());
    expect(navigateMock).toHaveBeenCalledWith(-1);
  });

  it("respeta state.from cuando se navegó con un origen explícito", () => {
    navigateMock.mockClear();
    const { result } = renderHook(() => useVolver("/embarques"), {
      wrapper: wrapperWithEntries([
        { pathname: "/embarques/123", state: { from: "/embarques?tab=activos" } },
      ]),
    });
    act(() => result.current());
    expect(navigateMock).toHaveBeenCalledWith("/embarques?tab=activos");
  });
});
