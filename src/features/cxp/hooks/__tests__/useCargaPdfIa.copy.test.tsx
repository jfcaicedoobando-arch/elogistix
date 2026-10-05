import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCargaPdfIa } from "../useCargaPdfIa";
import { AUTH_ERROR_MESSAGES } from "@/constants/authMessages";

const mocks = vi.hoisted(() => ({ parse: vi.fn(), notifyError: vi.fn(), notifySuccess: vi.fn() }));
vi.mock("@/features/cxp/services/parsePdfInvoice", () => ({ parsePdfInvoice: mocks.parse }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: mocks.notifyError, notifySuccess: mocks.notifySuccess }));
vi.mock("@/hooks/shared/useOrgActiva", () => ({ useOrgActiva: () => ({ organizationId: "org-mock" }) }));
beforeEach(() => vi.clearAllMocks());

describe("PDF: título legible, diagnóstico intacto", () => {
  it.each([
    ["parse-invoice-pdf respondió HTTP 418", "Intenta de nuevo o usa Captura manual."],
    [AUTH_ERROR_MESSAGES.sessionRefreshFailed, AUTH_ERROR_MESSAGES.sessionRefreshFailed],
    [AUTH_ERROR_MESSAGES.sessionRequired("procesar la factura PDF"), "Debes iniciar sesión"],
  ])("presenta %s sin perder la excepción original", async (message, description) => {
    const error = new Error(message);
    mocks.parse.mockRejectedValue(error);
    const onParsed = vi.fn();
    const { result } = renderHook(() => useCargaPdfIa({ categorias: [], onParsed }));
    act(() => result.current.handlePdf(new File(["%PDF"], "factura-mock.pdf", { type: "application/pdf" })));
    await act(async () => { await result.current.procesar(); });
    const options = mocks.notifyError.mock.calls.at(-1)?.[1];
    expect(options.title).toBe("No se pudo leer la factura PDF");
    expect(options.description).toContain(description);
    expect(options.error).toBe(error);
    expect(onParsed).not.toHaveBeenCalled();
    expect(mocks.notifySuccess).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });
});
