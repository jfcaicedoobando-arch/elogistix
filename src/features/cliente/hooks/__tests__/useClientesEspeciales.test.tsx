import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClientesEspeciales } from "../useClientesEspeciales";
import { clientes } from "../../queryKeys";

const mocks = vi.hoisted(() => ({ organizationId: null as string | null, fetch: vi.fn() }));
vi.mock("@/hooks/shared/useOrgActiva", () => ({
  useOrgActiva: () => ({ organizationId: mocks.organizationId }),
}));
vi.mock("../../services/listado", () => ({ fetchClientesEspeciales: mocks.fetch }));

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useClientesEspeciales(), { wrapper }) };
}

beforeEach(() => { mocks.organizationId = null; mocks.fetch.mockReset(); });

describe("useClientesEspeciales", () => {
  it("no consulta sin organización", () => {
    const { result } = setup();
    expect(result.current.fetchStatus).toBe("idle");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("conserva el contrato de caché y separa cambios de organización", async () => {
    mocks.organizationId = "org-a";
    mocks.fetch.mockImplementation(async (id: string) => [{ id, nombre: id }]);
    const { client, result, rerender } = setup();
    await waitFor(() => expect(result.current.data?.[0].id).toBe("org-a"));
    expect(client.getQueryData(clientes.especiales("org-a"))).toEqual([{ id: "org-a", nombre: "org-a" }]);
    expect(clientes.especiales("org-a")).toEqual(["clientes", "especiales", "org-a"]);
    mocks.organizationId = "org-b";
    rerender();
    await waitFor(() => expect(result.current.data?.[0].id).toBe("org-b"));
    expect(mocks.fetch).toHaveBeenCalledWith("org-b");
    expect(client.getQueryData(clientes.especiales("org-a"))).toEqual([{ id: "org-a", nombre: "org-a" }]);
  });
});
