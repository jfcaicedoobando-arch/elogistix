import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { createWrapper } from "@/test/utils/queryWrapper";
import { queryKeys } from "@/lib/query";
const mocks = vi.hoisted(() => ({ consultar: vi.fn(), refacturar: vi.fn(), navigate: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("@/features/proformas/services/refacturar", () => ({ facturaCanceladaDeProforma: mocks.consultar, refacturarProforma: mocks.refacturar }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifySuccess: mocks.success, notifyError: mocks.error }));
import { useFacturaCanceladaDeProforma, useRefacturarProforma } from "../useRefacturarProforma";

describe("refacturar proforma hooks", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());
  it("consulta sólo cuando está habilitada y mantiene caché bajo proformas", async () => {
    mocks.consultar.mockResolvedValue("FAC-1");
    const { result, rerender } = renderHook(({ habilitada }) => useFacturaCanceladaDeProforma("p-1", habilitada), {
      wrapper: createWrapper(), initialProps: { habilitada: false },
    });
    expect(mocks.consultar).not.toHaveBeenCalled();
    rerender({ habilitada: true });
    await waitFor(() => expect(result.current.data).toBe("FAC-1"));
    expect(mocks.consultar).toHaveBeenCalledWith("p-1");
    expect(queryKeys.proformas.facturaCancelada("p-1").slice(0, 1)).toEqual(queryKeys.proformas.all);
  });
  it("invalida caché antes de cerrar y navegar a la copia", async () => {
    const invalidar = vi.spyOn(QueryClient.prototype, "invalidateQueries").mockResolvedValue();
    mocks.refacturar.mockResolvedValue({ nueva_proforma_id: "p-2", nuevo_numero: "P-2", anterior_numero: "P-1" });
    const cerrar = vi.fn();
    const { result } = renderHook(() => useRefacturarProforma("p-1", cerrar), { wrapper: createWrapper() });
    await act(async () => { await result.current.mutateAsync(); });
    expect(mocks.refacturar).toHaveBeenCalledWith("p-1");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: queryKeys.proformas.all });
    expect(cerrar).toHaveBeenCalledOnce();
    expect(invalidar.mock.invocationCallOrder[0]).toBeLessThan(cerrar.mock.invocationCallOrder[0]);
    expect(cerrar.mock.invocationCallOrder[0]).toBeLessThan(mocks.navigate.mock.invocationCallOrder[0]);
    expect(mocks.navigate).toHaveBeenCalledWith("/proformas/p-2");
  });
  it("un error conserva el diálogo y no navega", async () => {
    const error = new Error("No autorizado");
    mocks.refacturar.mockRejectedValue(error);
    const cerrar = vi.fn();
    const { result } = renderHook(() => useRefacturarProforma("p-1", cerrar), { wrapper: createWrapper() });
    await act(async () => { await expect(result.current.mutateAsync()).rejects.toBe(error); });
    expect(cerrar).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith(undefined, expect.objectContaining({ error, method: "REFACTURAR_PROFORMA" }));
  });
});
