import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { crearAgenteProvisional } from "@/features/proveedor/services/altaProvisional";
import { useAgenteProvisionalDialog } from "../useAgenteProvisionalDialog";

vi.mock("@/features/proveedor/services/altaProvisional", () => ({ crearAgenteProvisional: vi.fn() }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

function setup() {
  const client = new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: Infinity }, mutations: { retry: false },
  } });
  const onCreado = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, onCreado, ...renderHook(() => useAgenteProvisionalDialog(onCreado), { wrapper }) };
}

const input = { nombre: " Agente nuevo ", pais: "MX", contacto: "Ana", email: "ana@example.test" };
beforeEach(() => vi.clearAllMocks());

describe("useAgenteProvisionalDialog", () => {
  it("conserva la validación del nombre y el borrador al cerrar y reabrir", () => {
    const hook = setup();
    expect(hook.result.current.puede).toBe(false);
    act(() => { hook.result.current.setOpen(true); hook.result.current.setF({ ...input, nombre: " a " }); });
    expect(hook.result.current.puede).toBe(false);
    act(() => { hook.result.current.setF(input); hook.result.current.setOpen(false); });
    act(() => hook.result.current.setOpen(true));
    expect(hook.result.current.f).toEqual(input);
    expect(hook.result.current.puede).toBe(true);
    expect(crearAgenteProvisional).not.toHaveBeenCalled();
    hook.unmount(); hook.client.clear();
  });

  it("al crear refresca agentes y proveedores, selecciona el id y reinicia el diálogo", async () => {
    vi.mocked(crearAgenteProvisional).mockResolvedValue("ag-1");
    const hook = setup();
    const keys = [queryKeys.costeo.agentes.list("org-1"), queryKeys.proveedores.provisionales(), queryKeys.proveedores.list({})];
    keys.forEach((key) => hook.client.setQueryData(key, []));
    act(() => { hook.result.current.setOpen(true); hook.result.current.setF(input); });
    await act(async () => { await hook.result.current.crear.mutateAsync(); });
    expect(crearAgenteProvisional).toHaveBeenCalledExactlyOnceWith(input);
    keys.forEach((key) => expect(hook.client.getQueryState(key)?.isInvalidated).toBe(true));
    expect(hook.onCreado).toHaveBeenCalledExactlyOnceWith("ag-1");
    expect(hook.result.current.open).toBe(false);
    expect(hook.result.current.f).toEqual({ nombre: "", pais: "CN", contacto: "", email: "" });
    expect(notifySuccess).toHaveBeenCalledTimes(1);
    hook.unmount(); hook.client.clear();
  });

  it("bloquea Guardar mientras está pendiente y conserva datos ante error para reintentar", async () => {
    let reject!: (error: Error) => void;
    vi.mocked(crearAgenteProvisional).mockReturnValueOnce(new Promise((_resolve, fail) => { reject = fail; }));
    const hook = setup();
    act(() => { hook.result.current.setOpen(true); hook.result.current.setF(input); });
    act(() => hook.result.current.crear.mutate());
    await waitFor(() => expect(hook.result.current.crear.isPending).toBe(true));
    expect(hook.result.current.puede).toBe(false);
    const error = new Error("Sin organización activa");
    await act(async () => reject(error));
    await waitFor(() => expect(hook.result.current.crear.isError).toBe(true));
    expect(hook.result.current.f).toEqual(input);
    expect(hook.result.current.open).toBe(true);
    expect(hook.result.current.puede).toBe(true);
    expect(hook.onCreado).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
    expect(notifyError).toHaveBeenCalledExactlyOnceWith(undefined, expect.objectContaining({ description: error.message, error }));
    vi.mocked(crearAgenteProvisional).mockResolvedValueOnce("ag-retry");
    await act(async () => { await hook.result.current.crear.mutateAsync(); });
    expect(hook.onCreado).toHaveBeenCalledExactlyOnceWith("ag-retry");
    expect(hook.result.current.open).toBe(false);
    hook.unmount(); hook.client.clear();
  });
});
