import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const { mockListar } = vi.hoisted(() => ({
  mockListar: vi.fn(),
}));

vi.mock("@/features/embarques/services/contenedores", () => ({
  listarPorEmbarque: mockListar,
}));

import { useContenedoresEmbarque } from "../useContenedoresEmbarque";

const stub = [{ id: "c-1", numero_contenedor: "MSCU1234567", embarque_id: "e-1" }];

beforeEach(() => {
  mockListar.mockReset();
});

describe("useContenedoresEmbarque", () => {
  it("devuelve contenedores cuando embarqueId está definido", async () => {
    mockListar.mockResolvedValue(stub);
    const { result } = renderHook(() => useContenedoresEmbarque("e-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(stub);
    expect(mockListar).toHaveBeenCalledWith("e-1");
  });

  it("no ejecuta la query cuando embarqueId es undefined", () => {
    const { result } = renderHook(() => useContenedoresEmbarque(undefined), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockListar).not.toHaveBeenCalled();
  });

  it("propaga error cuando el servicio rechaza", async () => {
    mockListar.mockRejectedValue(new Error("DB error"));
    const { result } = renderHook(() => useContenedoresEmbarque("e-err"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("DB error");
  });
});
