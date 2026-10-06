import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
const mocks = vi.hoisted(() => ({ subir: vi.fn(), warning: vi.fn(), success: vi.fn() }));
vi.mock("@/features/cxp/services/facturasEntrantes", () => ({ subirFacturaEntranteConResultado: mocks.subir }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: mocks.warning, notifySuccess: mocks.success, notifyError: vi.fn() }));
import { useSubirFacturaEntrante } from "../useFacturasEntrantes";
import type { SubirFacturaEntranteInput } from "../../services/facturasEntrantes.types";

describe("saved inbox document with partial suggestion failure", () => {
  it.each([false, true])("keeps the saved identity with XML pending=%s and shows exactly one warning", async (verificacionXmlPendiente) => {
    mocks.warning.mockClear(); mocks.success.mockClear(); mocks.subir.mockClear();
    mocks.subir.mockResolvedValue({ documentoId: "saved-id", sugerenciasGuardadas: false, verificacionXmlPendiente, bitacoraPendiente: false });
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    const { result } = renderHook(() => useSubirFacturaEntrante(), { wrapper });
    const saved = await result.current.mutateAsync({} as SubirFacturaEntranteInput);
    expect(saved.documentoId).toBe("saved-id");
    await waitFor(() => expect(mocks.warning).toHaveBeenCalledTimes(1));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.subir).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalled();
  });
});
