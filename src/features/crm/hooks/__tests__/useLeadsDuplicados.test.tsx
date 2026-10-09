import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import type { LeadExistente } from "@/features/crm/domain/leadsDedupe";

const mocks = vi.hoisted(() => ({
  buscar: vi.fn(), org: { organizationId: "org-a", orgListo: true },
}));
vi.mock("@/features/crm/services/leadsDuplicados", () => ({ buscarLeadsDuplicados: mocks.buscar }));
vi.mock("@/hooks/shared/useOrgFilter", () => ({ useOrgFilter: () => mocks.org }));

import { useDuplicadoLead, useDuplicadosLote } from "../useLeadsDuplicados";

const filas = [{ empresa: "Acme", email: "lead@example.test" }];
const existentes: LeadExistente[] = [{ id: "lead-a", ...filas[0] }];
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function pendiente<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  mocks.buscar.mockReset();
  mocks.org = { organizationId: "org-a", orgListo: true };
});

describe("revisión completa de duplicados", () => {
  it("no clasifica filas antes de completar la consulta", async () => {
    const consulta = pendiente<LeadExistente[]>();
    mocks.buscar.mockReturnValue(consulta.promise);
    const { result } = renderHook(() => useDuplicadosLote(filas), { wrapper: wrapper() });
    expect(result.current.listo).toBe(false);
    expect(result.current.coincidencias).toEqual([]);
    await act(async () => { consulta.resolve(existentes); });
    await waitFor(() => expect(result.current.listo).toBe(true));
    expect(result.current.coincidencias[0].nivel).toBe("exacto");
  });

  it("oculta datos de caché durante refetch y después de su fallo", async () => {
    mocks.buscar.mockResolvedValueOnce(existentes);
    const { result } = renderHook(() => useDuplicadosLote(filas), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.listo).toBe(true));
    const consulta = pendiente<LeadExistente[]>();
    mocks.buscar.mockReturnValueOnce(consulta.promise);
    act(() => { void result.current.refetch(); });
    await waitFor(() => expect(result.current.isFetching).toBe(true));
    expect(result.current.listo).toBe(false);
    expect(result.current.coincidencias).toEqual([]);
    expect(result.current.existentes).toEqual([]);
    await act(async () => { consulta.reject(new Error("Fallo del lote")); });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.listo).toBe(false);
    expect(result.current.coincidencias).toEqual([]);
    expect(result.current.existentes).toEqual([]);
    mocks.buscar.mockResolvedValueOnce([]);
    await act(async () => { await result.current.refetch(); });
    await waitFor(() => expect(result.current.listo).toBe(true));
    expect(result.current.coincidencias[0].nivel).toBe("nuevo");
  });

  it("separa la caché por organización y espera su contexto", async () => {
    mocks.buscar.mockResolvedValueOnce(existentes);
    const { result, rerender } = renderHook(() => useDuplicadosLote(filas), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.listo).toBe(true));
    const consulta = pendiente<LeadExistente[]>();
    mocks.buscar.mockReturnValueOnce(consulta.promise);
    mocks.org = { organizationId: "org-b", orgListo: false };
    rerender();
    expect(result.current.listo).toBe(false);
    expect(result.current.coincidencias).toEqual([]);
    expect(mocks.buscar).toHaveBeenCalledTimes(1);
    mocks.org.orgListo = true;
    rerender();
    await waitFor(() => expect(mocks.buscar).toHaveBeenCalledTimes(2));
    expect(result.current.coincidencias).toEqual([]);
    await act(async () => { consulta.resolve([]); });
    await waitFor(() => expect(result.current.listo).toBe(true));
    expect(result.current.coincidencias[0].nivel).toBe("nuevo");
  });

  it("alta manual tampoco clasifica una revisión pendiente o deshabilitada", async () => {
    const consulta = pendiente<LeadExistente[]>();
    mocks.buscar.mockReturnValue(consulta.promise);
    const { result, rerender } = renderHook(({ enabled }) => useDuplicadoLead(filas[0], enabled), {
      initialProps: { enabled: true }, wrapper: wrapper(),
    });
    expect(result.current.coincidencia).toBeNull();
    await act(async () => { consulta.resolve(existentes); });
    await waitFor(() => expect(result.current.coincidencia?.nivel).toBe("exacto"));
    rerender({ enabled: false });
    expect(result.current.coincidencia).toBeNull();
  });
});
