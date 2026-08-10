import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MockInstance } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const svcEliminar = vi.fn();
const notifySuccess = vi.fn();
const notifyWarning = vi.fn();
const notifyError = vi.fn();

vi.mock("@/features/proformas/services", () => ({
  crearProforma: vi.fn(),
  eliminarProforma: (...args: unknown[]) => svcEliminar(...args),
  fetchProformasTodas: vi.fn(),
  fetchProformasEmbarque: vi.fn(),
}));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: (...a: unknown[]) => notifySuccess(...a),
  notifyWarning: (...a: unknown[]) => notifyWarning(...a),
  notifyError: (...a: unknown[]) => notifyError(...a),
}));
vi.mock("@/hooks/shared", () => ({ useOrgFilter: () => ({ organizationId: "org1" }) }));

import { useEliminarProforma } from "../useProformas";

function wrapper(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("useEliminarProforma", () => {
  let qc: QueryClient;
  let invalidate: MockInstance<QueryClient["invalidateQueries"]>;

  beforeEach(() => {
    vi.clearAllMocks();
    qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    invalidate = vi.spyOn(qc, "invalidateQueries");
  });

  it("notifica éxito e invalida cachés al borrar", async () => {
    svcEliminar.mockResolvedValue(undefined);
    const { result } = renderHook(() => useEliminarProforma(), { wrapper: wrapper(qc) });
    await act(async () => {
      result.current.mutate({ proformaId: "p1", embarqueId: "e1", numero: "PRO-1" });
    });
    await waitFor(() => expect(notifySuccess).toHaveBeenCalled());
    expect(notifyError).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();
  });

  it("ante 'ya borrado' avisa y refresca en vez de mostrar error técnico", async () => {
    svcEliminar.mockRejectedValue(new Error("Registro no encontrado o ya borrado"));
    const { result } = renderHook(() => useEliminarProforma(), { wrapper: wrapper(qc) });
    await act(async () => {
      result.current.mutate({ proformaId: "p1", embarqueId: "e1", numero: "PRO-1" });
    });
    await waitFor(() => expect(notifyWarning).toHaveBeenCalled());
    expect(notifyWarning.mock.calls[0][1]).toMatchObject({
      title: expect.stringContaining("ya había sido eliminada"),
    });
    expect(notifyError).not.toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalled();
  });

  it("traduce el candado de embarque cerrado a un mensaje claro", async () => {
    svcEliminar.mockRejectedValue(
      new Error("Embarque cerrado: edición bloqueada (tabla conceptos_venta)"),
    );
    const { result } = renderHook(() => useEliminarProforma(), { wrapper: wrapper(qc) });
    await act(async () => {
      result.current.mutate({ proformaId: "p1", embarqueId: "e1", numero: "PRO-1" });
    });
    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(notifyError.mock.calls[0][1]).toMatchObject({
      title: "Embarque cerrado: no se puede eliminar la proforma",
    });
  });

  it("otros errores siguen reportándose como error", async () => {
    svcEliminar.mockRejectedValue(new Error("permiso denegado"));
    const { result } = renderHook(() => useEliminarProforma(), { wrapper: wrapper(qc) });
    await act(async () => {
      result.current.mutate({ proformaId: "p1", embarqueId: "e1", numero: "PRO-1" });
    });
    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(notifyWarning).not.toHaveBeenCalled();
  });
});
