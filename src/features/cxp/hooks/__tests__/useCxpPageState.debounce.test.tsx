import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { mockFetchFacturas } = vi.hoisted(() => ({
  mockFetchFacturas: vi.fn(),
}));

vi.mock("@/features/cxp/services", () => ({
  fetchFacturasCxP: mockFetchFacturas,
  calcularKPIsCxP: vi.fn(() => ({ total: 0 })),
}));

import { useFacturasCxP } from "../useFacturasCxP";
import { useCxpPageState } from "../useCxpPageState";

describe("useCxpPageState — debounce de búsqueda", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetchFacturas.mockReset();
    mockFetchFacturas.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("5 llamadas seguidas a setSearch disparan una sola consulta tras 300ms", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(
      () => {
        const state = useCxpPageState();
        const query = useFacturasCxP(state.queryArgs);
        return { state, query };
      },
      { wrapper },
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    mockFetchFacturas.mockClear();

    act(() => {
      result.current.state.setSearch("a");
      result.current.state.setSearch("ab");
      result.current.state.setSearch("abc");
      result.current.state.setSearch("abcd");
      result.current.state.setSearch("abcde");
    });

    // Antes de que venza el debounce, no debe haberse disparado ninguna consulta nueva.
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(mockFetchFacturas).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockFetchFacturas).toHaveBeenCalledTimes(1);
    expect(mockFetchFacturas).toHaveBeenCalledWith(
      expect.objectContaining({ search: "abcde" }),
    );
  });
});
