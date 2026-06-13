import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useClienteFinancials } from "../useClienteFinancials";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/services/cliente", () => ({
  fetchClienteFinancials: vi.fn().mockResolvedValue({ balance: 1000, creditLimit: 5000 }),
}));

describe("useClienteFinancials", () => {
  it("fetches financials for a given client id", async () => {
    const { result } = renderHook(() => useClienteFinancials("client-1"), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((result.current.data as any)?.balance).toBe(1000);
  });

  it("is disabled when client id is missing", () => {
    const { result } = renderHook(() => useClienteFinancials(undefined), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(false);
  });
});
