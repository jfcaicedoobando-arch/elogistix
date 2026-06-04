import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useExchangeRates } from "../useExchangeRates";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/services/catalogos", () => ({
  fetchExchangeRates: vi.fn().mockResolvedValue([{ pair: "USD/MXN", rate: 20 }]),
}));

describe("useExchangeRates", () => {
  it("fetches exchange rates", async () => {
    const { result } = renderHook(() => useExchangeRates(), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].rate).toBe(20);
  });
});
