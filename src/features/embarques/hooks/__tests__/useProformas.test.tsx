import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useProformas, useCrearProforma } from "../useProformas";

vi.mock("@/features/embarques/services/proforma", () => ({
  fetchProformasEmbarque: vi.fn().mockResolvedValue([]),
  crearProforma: vi.fn().mockResolvedValue({ id: "prof-1" }),
}));

const wrapper = createWrapper();

describe("useProformas", () => {
  it("useProformas retorna el query", () => {
    const { result } = renderHook(() => useProformas("emb-1"), { wrapper });
    expect(result.current.data).toBeDefined();
  });

  it("useCrearProforma retorna la mutación", () => {
    const { result } = renderHook(() => useCrearProforma(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });
});
