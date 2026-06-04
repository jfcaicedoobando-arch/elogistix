import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

vi.mock("@/features/embarques/services/contenedores/fetchInfoMap", () => ({
  fetchContenedoresInfoMap: mockFetch,
}));

import { useContenedoresInfoMap } from "../useContenedoresInfoMap";

beforeEach(() => mockFetch.mockReset());

describe("useContenedoresInfoMap", () => {
  it("llama fetchContenedoresInfoMap con ids ordenados y retorna mapa", async () => {
    const map = { "e-2": { count: 1, first: null, hasPending: false }, "e-1": { count: 2, first: null, hasPending: true } };
    mockFetch.mockResolvedValue(map);
    const { result } = renderHook(() => useContenedoresInfoMap(["e-2", "e-1"]), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(map);
    expect(mockFetch).toHaveBeenCalledWith(["e-1", "e-2"]);
  });

  it("no ejecuta query con array vacío", () => {
    const { result } = renderHook(() => useContenedoresInfoMap([]), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
