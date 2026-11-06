import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppRole } from "@/types/appRole";

const mocks = vi.hoisted(() => ({
  role: "vendedor" as AppRole | null,
  organizationId: "org1" as string | null,
  fetchHandover: vi.fn(),
}));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ effectiveRole: mocks.role }) }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => ({ organizationId: mocks.organizationId }) }));
vi.mock("../../services/handover", () => ({ fetchHandover: mocks.fetchHandover }));
import { useCotizacionHandover } from "../useCotizacionHandover";

const cotizacion = { id: "c1", organization_id: "org1", updated_at: "2026-11-06" };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook((row) => useCotizacionHandover(row), { wrapper, initialProps: cotizacion });
}
beforeEach(() => {
  mocks.role = "vendedor";
  mocks.organizationId = "org1";
  mocks.fetchHandover.mockReset().mockImplementation(async (id, org) => ({ id: `${org}-${id}` }));
});

describe("useCotizacionHandover", () => {
  it("consulta la cotización en la empresa activa y refresca cuando cambia", async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(mocks.fetchHandover).toHaveBeenCalledWith("c1", "org1");
    rerender({ ...cotizacion, updated_at: "2026-11-07" });
    await waitFor(() => expect(mocks.fetchHandover).toHaveBeenCalledTimes(2));
  });
  it.each(["cliente", null] as const)("no consulta para rol %s, incluso al reintentar", async (role) => {
    mocks.role = role;
    const { result } = setup();
    expect(result.current.visible).toBe(false);
    await act(async () => { await result.current.query.refetch(); });
    expect(mocks.fetchHandover).not.toHaveBeenCalled();
  });
  it("oculta datos previos y bloquea lecturas al cambiar de empresa", async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    mocks.organizationId = "org2";
    rerender({ ...cotizacion });
    expect(result.current.visible).toBe(false);
    expect(result.current.query.data).toBeUndefined();
    await act(async () => { await result.current.query.refetch(); });
    expect(mocks.fetchHandover).toHaveBeenCalledTimes(1);
    rerender({ ...cotizacion, organization_id: "org2" });
    await waitFor(() => expect(result.current.query.data).toEqual({ id: "org2-c1" }));
    expect(mocks.fetchHandover).toHaveBeenLastCalledWith("c1", "org2");
  });
  it("no consulta cuando falta empresa activa", async () => {
    mocks.organizationId = null;
    const { result } = setup();
    await act(async () => { await result.current.query.refetch(); });
    expect(result.current.visible).toBe(false);
    expect(mocks.fetchHandover).not.toHaveBeenCalled();
  });
});
