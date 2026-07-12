/**
 * Tests focalizados de `useIsDemoUser` — migrado a React Query.
 * Verifica: (a) no llama al RPC sin userId, (b) devuelve booleano.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("@/features/marketing/services/demoMode", () => ({
  fetchIsDemoUser: vi.fn(),
}));

import { useAuth } from "@/lib/contexts/AuthContext";
import { fetchIsDemoUser } from "@/features/marketing/services/demoMode";
import { useIsDemoUser } from "@/features/marketing/hooks/useIsDemoUser";

const mockUseAuth = vi.mocked(useAuth);
const mockFetch = vi.mocked(fetchIsDemoUser);

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return wrapper;
}

describe("useIsDemoUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devuelve false y no llama al servicio si no hay usuario", () => {
    mockUseAuth.mockReturnValue({ user: null } as never);
    const { result } = renderHook(() => useIsDemoUser(), { wrapper: makeWrapper() });
    expect(result.current).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("devuelve true cuando el RPC responde true para el userId", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "u-demo" } } as never);
    mockFetch.mockResolvedValue(true);
    const { result } = renderHook(() => useIsDemoUser(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current).toBe(true));
    expect(mockFetch).toHaveBeenCalledWith("u-demo");
  });

  it("devuelve false cuando el RPC responde false", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "u-normal" } } as never);
    mockFetch.mockResolvedValue(false);
    const { result } = renderHook(() => useIsDemoUser(), { wrapper: makeWrapper() });
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
