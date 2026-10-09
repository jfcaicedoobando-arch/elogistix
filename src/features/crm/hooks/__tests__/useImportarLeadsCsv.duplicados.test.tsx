import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import type { LeadClave, LeadExistente } from "@/features/crm/domain/leadsDedupe";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), mutate: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("@/lib/auth/authOperationScope", () => ({
  captureAuthOperationScope: () => ({ assertCurrent: vi.fn() }),
}));
vi.mock("@/hooks/shared/useOrgFilter", () => ({
  useOrgFilter: () => ({ organizationId: "org-a", orgListo: true }),
}));
vi.mock("@/features/crm/hooks", () => ({
  useCrearLeadsBulk: () => ({ mutateAsync: mocks.mutate, isPending: false }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: vi.fn(), notifyError: vi.fn() }));

import { useImportarLeadsCsv } from "../useImportarLeadsCsv";

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
function archivo(count: number): File {
  const text = "empresa,email\n" + Array.from({ length: count }, (_, i) => `Empresa ${i},lead-${i}@example.test`).join("\n");
  const bytes = new TextEncoder().encode(text);
  const file = new File([bytes], "leads.csv", { type: "text/csv" });
  Object.defineProperty(file, "arrayBuffer", { value: async () => bytes.buffer });
  return file;
}
beforeEach(() => { mocks.rpc.mockReset(); mocks.mutate.mockReset(); });

describe("CSV con revisión de todos los lotes (sin importaciones reales)", () => {
  it.each([501, 1001])("omite el duplicado en la última de %i filas", async (count) => {
    const final = `lead-${count - 1}@example.test`;
    mocks.rpc.mockImplementation((_name: string, { p_claves }: { p_claves: LeadClave[] }) => ({
      order: () => ({ range: async () => ({
        data: p_claves.some((c) => c.email === final) ? [{ id: "existente", empresa: `Empresa ${count - 1}`, email: final }] : [],
        error: null, count: p_claves.some((c) => c.email === final) ? 1 : 0,
      }) }),
    }));
    const { result } = renderHook(() => useImportarLeadsCsv({ onDone: vi.fn() }), { wrapper: wrapper() });
    await act(async () => { await result.current.handleFile(archivo(count)); });
    await waitFor(() => expect(result.current.puedeImportar).toBe(true));
    expect(result.current.duplicados).toHaveLength(count);
    expect(result.current.duplicados.at(-1)?.nivel).toBe("exacto");
    expect(result.current.validRows).toHaveLength(count - 1);
    expect(result.current.validRows.some((row) => row.email === final)).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledTimes(Math.ceil(count / 500));
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("no permite importar al fallar un lote posterior y recupera tras reintentar", async () => {
    let fallo = true;
    mocks.rpc.mockImplementation((_name: string, { p_claves }: { p_claves: LeadClave[] }) => ({
      order: () => ({ range: async () => ({
        data: [], error: fallo && p_claves[0].email === "lead-500@example.test" ? new Error("Fallo segundo lote") : null, count: 0,
      }) }),
    }));
    const { result } = renderHook(() => useImportarLeadsCsv({ onDone: vi.fn() }), { wrapper: wrapper() });
    await act(async () => { await result.current.handleFile(archivo(1001)); });
    await waitFor(() => expect(result.current.duplicadosError).toBe(true));
    expect(result.current.duplicados).toEqual([]);
    expect(result.current.validRows).toEqual([]);
    expect(result.current.puedeImportar).toBe(false);
    await act(async () => { await result.current.handleImport(); });
    expect(mocks.mutate).not.toHaveBeenCalled();
    fallo = false;
    act(() => { result.current.reintentarDuplicados(); });
    await waitFor(() => expect(result.current.puedeImportar).toBe(true));
    expect(result.current.duplicados).toHaveLength(1001);
    expect(result.current.validRows).toHaveLength(1001);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("prioridad exacta: omite la fila cuyo correo exacto llega en un lote posterior", async () => {
    // El posible se consulta por el correo de la primera fila; el exacto por
    // el correo de la última. Su empresa diferente no coincide en el lote inicial.
    const posiblesYExactos: LeadExistente[] = [
      { id: "a-posible", empresa: "Empresa 500", email: "lead-0@example.test" },
      { id: "z-exacto", empresa: "Otra Empresa", email: "lead-500@example.test" },
    ];
    mocks.rpc.mockImplementation((_name: string, { p_claves }: { p_claves: LeadClave[] }) => ({
      order: () => ({ range: async () => {
        const data = posiblesYExactos.filter((ex) => p_claves.some((c) => c.email === ex.email || c.empresa === ex.empresa));
        return { data, error: null, count: data.length };
      } }),
    }));
    const { result } = renderHook(() => useImportarLeadsCsv({ onDone: vi.fn() }), { wrapper: wrapper() });
    await act(async () => { await result.current.handleFile(archivo(501)); });
    await waitFor(() => expect(result.current.duplicados).toHaveLength(501));
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(result.current.duplicados[500].nivel).toBe("exacto");
    expect(result.current.duplicados[500].existente?.id).toBe("z-exacto");
    expect(result.current.validRows.some((r) => r.email === "lead-500@example.test")).toBe(false);
    expect(result.current.duplicadosCount).toBe(2);
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});
