import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useTiposContenedor, useAdminTiposContenedor } from "../useTiposContenedor";
import { createWrapper } from "@/test/utils/queryWrapper";
import * as catalogosService from "@/features/catalogos/services";

vi.mock("@/features/catalogos/services", () => ({
  fetchTiposContenedor: vi.fn().mockResolvedValue([{ id: "1", name: "40 HC", code: "40HC" }]),
  insertTipoContenedor: vi.fn().mockResolvedValue({ success: true }),
  setTipoContenedorActivo: vi.fn().mockResolvedValue({ success: true }),
  deleteTipoContenedor: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/hooks/shared", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock("@/components/shared/utils/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

describe("useTiposContenedor", () => {
  it("fetches container types", async () => {
    const { result } = renderHook(() => useTiposContenedor(), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("handles container type mutations", async () => {
    const { result } = renderHook(() => useAdminTiposContenedor(), { wrapper: createWrapper() });

    // v13.137.24: envuelto en `act` para evitar warnings y contaminación
    // del QueryClient compartido bajo `singleFork`.
    await act(async () => {
      await result.current.agregarTipo.mutateAsync({ name: "20 ST", code: "20ST" });
    });
    expect(catalogosService.insertTipoContenedor).toHaveBeenCalled();
  });
});
