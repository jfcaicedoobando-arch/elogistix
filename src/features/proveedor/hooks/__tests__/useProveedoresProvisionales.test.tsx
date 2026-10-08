import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { aprobarProveedorProvisional, fetchProveedoresProvisionales } from "@/features/proveedor/services/altaProvisional";
import { useAprobarProveedorProvisional, useProveedoresProvisionales } from "../useProveedoresProvisionales";

vi.mock("@/features/proveedor/services/altaProvisional", () => ({
  aprobarProveedorProvisional: vi.fn(),
  fetchProveedoresProvisionales: vi.fn(),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

function setup() {
  const client = new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: Infinity }, mutations: { retry: false },
  } });
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("proveedores provisionales: query y aprobación", () => {
  it("consulta con la clave canónica y reutiliza la lista durante un minuto", async () => {
    const pending = [{ id: "prov-1", nombre: "Agente" }];
    vi.mocked(fetchProveedoresProvisionales).mockResolvedValue(pending);
    const { client, wrapper } = setup();
    const first = renderHook(useProveedoresProvisionales, { wrapper });
    await waitFor(() => expect(first.result.current.data).toEqual(pending));
    expect(client.getQueryData(queryKeys.proveedores.provisionales())).toEqual(pending);
    const second = renderHook(useProveedoresProvisionales, { wrapper });
    expect(second.result.current.data).toEqual(pending);
    expect(fetchProveedoresProvisionales).toHaveBeenCalledTimes(1);
    first.unmount(); second.unmount(); client.clear();
  });

  it("aprueba sólo por RPC e invalida lista, pendientes y detalle con el mismo prefijo", async () => {
    vi.mocked(aprobarProveedorProvisional).mockResolvedValue(undefined);
    const { client, wrapper } = setup();
    const keys = [queryKeys.proveedores.list({}), queryKeys.proveedores.detail("prov-1"), queryKeys.proveedores.provisionales()];
    keys.forEach((key) => client.setQueryData(key, []));
    client.setQueryData(queryKeys.costeo.agentes.all, []);
    const hook = renderHook(() => useAprobarProveedorProvisional("prov-1"), { wrapper });
    await act(async () => { await hook.result.current.mutateAsync(); });
    expect(aprobarProveedorProvisional).toHaveBeenCalledExactlyOnceWith("prov-1");
    keys.forEach((key) => expect(client.getQueryState(key)?.isInvalidated).toBe(true));
    expect(client.getQueryState(queryKeys.costeo.agentes.all)?.isInvalidated).toBe(false);
    expect(notifySuccess).toHaveBeenCalledExactlyOnceWith(undefined, { title: "Proveedor aprobado." });
    expect(notifyError).not.toHaveBeenCalled();
    hook.unmount(); client.clear();
  });

  it.each([
    [new Error("Sólo Contabilidad puede aprobar proveedores"), "Sólo Contabilidad puede aprobar proveedores"],
    ["rechazo RPC", "Completa los datos con Editar y vuelve a intentar."],
  ])("mantiene el estado y muestra el rechazo de aprobación: %s", async (error, description) => {
    vi.mocked(aprobarProveedorProvisional).mockRejectedValue(error);
    const { client, wrapper } = setup();
    client.setQueryData(queryKeys.proveedores.detail("prov-1"), { estado_alta: "provisional" });
    const hook = renderHook(() => useAprobarProveedorProvisional("prov-1"), { wrapper });
    await act(async () => { await expect(hook.result.current.mutateAsync()).rejects.toBe(error); });
    expect(client.getQueryData(queryKeys.proveedores.detail("prov-1"))).toEqual({ estado_alta: "provisional" });
    expect(client.getQueryState(queryKeys.proveedores.detail("prov-1"))?.isInvalidated).toBe(false);
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledExactlyOnceWith(undefined, expect.objectContaining({ description, error }));
    hook.unmount(); client.clear();
  });
});
