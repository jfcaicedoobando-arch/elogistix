import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const bulkUpdateLeads = vi.hoisted(() => vi.fn());
const bulkSoftDeleteLeads = vi.hoisted(() => vi.fn());
const bulkCreateLeads = vi.hoisted(() => vi.fn());

vi.mock("@/features/crm/services/leads", () => ({
  bulkUpdateLeads,
  bulkSoftDeleteLeads,
  bulkCreateLeads,
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/lib/query", () => ({
  queryKeys: {
    crm: { leads: { all: ["crm", "leads"] }, dashboardAll: ["crm", "dashboard"] },
  },
}));

import { useActualizarLeadsBulk, useEliminarLeadsBulk, useCrearLeadsBulk } from "../leads/bulk";

describe("leads bulk hooks", () => {
  beforeEach(() => {
    bulkUpdateLeads.mockReset();
    bulkSoftDeleteLeads.mockReset();
    bulkCreateLeads.mockReset();
  });


  it("useActualizarLeadsBulk llama a bulkUpdateLeads con ids y patch", async () => {
    bulkUpdateLeads.mockResolvedValueOnce({ affected: 1 });
    const { result } = renderHook(() => useActualizarLeadsBulk(), { wrapper: createWrapper() });
    result.current.mutate({ ids: ["l1"], patch: { estado: "Calificado" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(bulkUpdateLeads).toHaveBeenCalledWith(["l1"], { estado: "Calificado" });
  });

  it("useEliminarLeadsBulk llama a bulkSoftDeleteLeads", async () => {
    bulkSoftDeleteLeads.mockResolvedValueOnce({ affected: 1 });
    const { result } = renderHook(() => useEliminarLeadsBulk(), { wrapper: createWrapper() });
    result.current.mutate(["l2"]);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(bulkSoftDeleteLeads).toHaveBeenCalledWith(["l2"], "user-1");
  });

  it("useCrearLeadsBulk error path propaga el error", async () => {
    bulkCreateLeads.mockRejectedValueOnce(new Error("DB error"));
    const { result } = renderHook(() => useCrearLeadsBulk(), { wrapper: createWrapper() });
    result.current.mutate([]);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
