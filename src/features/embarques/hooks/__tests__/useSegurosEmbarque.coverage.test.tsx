import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createWrapper } from "@/test/utils/queryWrapper";
const { update, notifyError, notifySuccess } = vi.hoisted(() => ({ update: vi.fn(), notifyError: vi.fn(), notifySuccess: vi.fn() }));
vi.mock("@/features/embarques/services/seguros", () => ({
  updateSeguroEmbarque: update, createSeguroEmbarque: vi.fn(), deleteSeguroEmbarque: vi.fn(), fetchSegurosEmbarque: vi.fn(),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError, notifySuccess }));
import { useUpdateSeguro } from "../useSegurosEmbarque";
beforeEach(() => { vi.clearAllMocks(); });

describe("insurance coverage server error presentation", () => {
  it.each([
    ["LC_SEGURO_COBERTURA_INCOMPLETA", "La base de la factura atribuida a este embarque debe cubrir toda la prima y tener una valoración comprobable. Revisa la factura, la prima y la moneda."],
    ["LC_CONFLICTO_CONCURRENCIA", "La factura o el embarque cambió mientras guardabas. Recarga y revisa los datos antes de volver a guardar."],
  ])("translates %s and never displays successful save", async (code, title) => {
    const error = new Error(code);
    update.mockRejectedValue(error);
    const { result } = renderHook(() => useUpdateSeguro("shipment"), { wrapper: createWrapper() });
    await act(async () => { await expect(result.current.mutateAsync({ id: "policy", patch: { prima: 101 } })).rejects.toBe(error); });
    expect(notifyError).toHaveBeenCalledWith(undefined, expect.objectContaining({ title, error }));
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});
