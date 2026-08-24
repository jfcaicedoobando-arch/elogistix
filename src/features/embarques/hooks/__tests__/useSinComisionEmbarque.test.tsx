import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { QueryClient } from "@tanstack/react-query";
import { createWrapper } from "@/test/utils/queryWrapper";
import { queryKeys } from "@/lib/query";

const { mockFetch, mockSet } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock("@/features/embarques/services/comisionExclusion", () => ({
  fetchSinComisionEmbarque: mockFetch,
  setSinComisionEmbarque: mockSet,
}));

import { useSinComisionEmbarque, useSetSinComisionEmbarque } from "../useSinComisionEmbarque";

function testClient(): QueryClient {
  return (globalThis as unknown as { __TEST_QUERY_CLIENT__: QueryClient }).__TEST_QUERY_CLIENT__;
}

beforeEach(() => {
  mockFetch.mockReset();
  mockSet.mockReset();
});

describe("useSinComisionEmbarque", () => {
  it("lee el override con la key singular ['embarque', id, 'sin-comision']", async () => {
    mockFetch.mockResolvedValue({ override: true });
    const { result } = renderHook(() => useSinComisionEmbarque("e-1"), {
      wrapper: createWrapper(),
    });
    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith("e-1");
    expect(
      testClient().getQueryData(queryKeys.embarques.sinComision("e-1")),
    ).toEqual({ override: true });
  });
});

describe("useSetSinComisionEmbarque (fix B-1)", () => {
  it("invalida la key exacta sinComision además de los prefijos plural/comisiones", async () => {
    mockSet.mockResolvedValue(undefined);
    const { result } = renderHook(() => useSetSinComisionEmbarque(), {
      wrapper: createWrapper(),
    });
    const qc = testClient();

    // El bug era invalidar sólo ['embarques'] (plural), que NO cubre el árbol
    // singular ['embarque', id, 'sin-comision']: el Select volvía al valor viejo.
    qc.setQueryData(queryKeys.embarques.sinComision("e-1"), { override: null });
    qc.setQueryData([...queryKeys.embarques.all, "list", {}], []);
    qc.setQueryData([...queryKeys.comisiones.all, "list"], []);

    await act(async () => {
      await result.current.mutateAsync({ embarqueId: "e-1", valor: true });
    });

    expect(mockSet).toHaveBeenCalledWith("e-1", true);
    expect(
      qc.getQueryState(queryKeys.embarques.sinComision("e-1"))?.isInvalidated,
    ).toBe(true);
    expect(
      qc.getQueryState([...queryKeys.embarques.all, "list", {}])?.isInvalidated,
    ).toBe(true);
    expect(
      qc.getQueryState([...queryKeys.comisiones.all, "list"])?.isInvalidated,
    ).toBe(true);
  });
});
