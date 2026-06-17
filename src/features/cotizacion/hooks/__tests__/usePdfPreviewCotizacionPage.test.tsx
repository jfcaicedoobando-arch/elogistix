/**
 * Cobertura del wrapper hook `usePdfPreviewCotizacionPage` (Fase 2 #3).
 * Verifica que dispara las 2 sub-queries (cotización + emisor) y que
 * la query de cotización respeta `enabled: !!id`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { cotMock, emisorMock } = vi.hoisted(() => ({ cotMock: vi.fn(), emisorMock: vi.fn() }));
vi.mock("@/features/cotizacion/services", () => ({ fetchCotizacionById: cotMock }));
vi.mock("@/pdf/emisor", () => ({ cargarEmisorEmpresa: emisorMock }));

import { createWrapper } from "@/test/utils/queryWrapper";
import { usePdfPreviewCotizacionPage } from "../usePdfPreviewCotizacionPage";

beforeEach(() => {
  cotMock.mockReset();
  emisorMock.mockReset();
});

describe("usePdfPreviewCotizacionPage", () => {
  it("trae cotización y emisor cuando hay id", async () => {
    cotMock.mockResolvedValueOnce({ id: "C-1", folio: "COT-001" });
    emisorMock.mockResolvedValueOnce({ rfc: "ABC010101AAA" });
    const { result } = renderHook(() => usePdfPreviewCotizacionPage("C-1"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.cotizacion.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.emisor.isSuccess).toBe(true));
    expect(cotMock).toHaveBeenCalledWith("C-1");
    expect(emisorMock).toHaveBeenCalledTimes(1);
  });

  it("no dispara la query de cotización si el id es undefined", async () => {
    emisorMock.mockResolvedValueOnce({ rfc: "ABC010101AAA" });
    const { result } = renderHook(() => usePdfPreviewCotizacionPage(undefined), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.emisor.isSuccess).toBe(true));
    expect(cotMock).not.toHaveBeenCalled();
    expect(result.current.cotizacion.fetchStatus).toBe("idle");
  });
});
