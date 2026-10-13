import { beforeEach, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadMock"); return createSoftDeleteReadMock();
});
const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyInfo: notify }));
import { useSustitucionState } from "../useSustitucionState";
import { readPersisted, writePersisted } from "@/features/facturacion/services/sustitucionPersistence";
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  (globalThis as unknown as { __TEST_QUERY_CLIENT__?: QueryClient }).__TEST_QUERY_CLIENT__ = client;
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children);
}
beforeEach(() => { mock.reset(); sessionStorage.clear(); notify.mockReset(); writePersisted("original-test", "borrador-test"); });
it.each([null, { id: "borrador-test", estado: "Borrador", uuid_fiscal: null, deleted_at: "2026-10-01" }])("null de ausencia/baja activa el reset existente: %j", async row => {
  mock.queue("facturas", row);
  const { result } = renderHook(() => useSustitucionState("original-test", true), { wrapper: wrapper() });
  await waitFor(() => expect(readPersisted("original-test")).toBeNull());
  expect(result.current.step).toBe("intro"); expect(result.current.nuevaId).toBeNull(); expect(notify).toHaveBeenCalledOnce();
});
it.each(["Cancelada", "Sustituida"])("estado %s vivo conserva progreso y no ejecuta reset", async estado => {
  mock.queue("facturas", { id: "borrador-test", estado, uuid_fiscal: "uuid-fixture" });
  const { result } = renderHook(() => useSustitucionState("original-test", true), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.sustitutaEstadoLabel).toBe(estado));
  expect(result.current.step).toBe("confirmar"); expect(result.current.nuevaId).toBe("borrador-test");
  expect(readPersisted("original-test")?.nuevaId).toBe("borrador-test"); expect(notify).not.toHaveBeenCalled();
});
it("error de lectura conserva el error y no resetea como si faltara el borrador", async () => {
  const error = new Error("lectura-sustituta"); mock.queue("facturas", null, error);
  const { result } = renderHook(() => useSustitucionState("original-test", true), { wrapper: wrapper() });
  await waitFor(() => expect(result.current.sustitutaQuery.isError).toBe(true));
  expect(result.current.step).toBe("confirmar"); expect(readPersisted("original-test")).not.toBeNull(); expect(notify).not.toHaveBeenCalled();
});
