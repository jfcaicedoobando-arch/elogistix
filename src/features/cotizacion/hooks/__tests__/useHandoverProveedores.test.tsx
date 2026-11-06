import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppRole } from "@/types/appRole";

const mocks = vi.hoisted(() => ({
  role: "vendedor" as AppRole | null,
  organizationId: "org1" as string | null,
  fetchHandoverProveedores: vi.fn(),
}));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ effectiveRole: mocks.role }) }));
vi.mock("@/lib/contexts/OrganizationContext", () => ({ useOrganization: () => ({ organizationId: mocks.organizationId }) }));
vi.mock("../../services/handover", () => ({ fetchHandoverProveedores: mocks.fetchHandoverProveedores }));
import { useHandoverProveedores } from "../useHandoverProveedores";

const cotizacion = { organization_id: "org1", agente_id: "a1", naviera_id: "n1", tieneHandover: true };
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook((row) => useHandoverProveedores(row, row.tieneHandover), { wrapper, initialProps: cotizacion });
}
beforeEach(() => {
  mocks.role = "vendedor";
  mocks.organizationId = "org1";
  mocks.fetchHandoverProveedores.mockReset().mockImplementation(async (org, id) => ({ agente: `${org}-${id}`, naviera: "Naviera QA" }));
});

describe("useHandoverProveedores", () => {
  it("consulta proveedores en empresa activa y refresca cuando cambia agente", async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocks.fetchHandoverProveedores).toHaveBeenCalledWith("org1", "a1", "n1");
    rerender({ ...cotizacion, agente_id: "a2" });
    await waitFor(() => expect(mocks.fetchHandoverProveedores).toHaveBeenCalledTimes(2));
  });
  it.each(["cliente", null] as const)("no consulta para rol %s, incluso al reintentar", async (role) => {
    mocks.role = role;
    const { result } = setup();
    expect(result.current.isFetching).toBe(false);
    await act(async () => { await result.current.refetch(); });
    expect(mocks.fetchHandoverProveedores).not.toHaveBeenCalled();
  });
  it("oculta datos previos y bloquea lecturas al cambiar de empresa", async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    mocks.organizationId = "org2";
    rerender({ ...cotizacion });
    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
    await act(async () => { await result.current.refetch(); });
    expect(mocks.fetchHandoverProveedores).toHaveBeenCalledTimes(1);
    rerender({ ...cotizacion, organization_id: "org2" });
    await waitFor(() => expect(result.current.data).toEqual({ agente: "org2-a1", naviera: "Naviera QA" }));
    expect(mocks.fetchHandoverProveedores).toHaveBeenLastCalledWith("org2", "a1", "n1");
  });
  it("no consulta ni permite refetch sin handover existente", async () => {
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    mocks.fetchHandoverProveedores.mockClear();
    rerender({ ...cotizacion, tieneHandover: false });
    await act(async () => { await result.current.refetch(); });
    expect(mocks.fetchHandoverProveedores).not.toHaveBeenCalled();
  });
  it("no consulta cuando falta empresa activa", async () => {
    mocks.organizationId = null;
    const { result } = setup();
    await act(async () => { await result.current.refetch(); });
    expect(result.current.isFetching).toBe(false);
    expect(mocks.fetchHandoverProveedores).not.toHaveBeenCalled();
  });
});
