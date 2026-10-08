/**
 * Cobertura del wrapper hook `usePdfPreviewCotizacionPage` (Fase 2 #3).
 * Verifica que dispara las 2 sub-queries (cotización + emisor) y que
 * la query de cotización respeta `enabled: !!id`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { cotMock, emisorMock, active } = vi.hoisted(() => ({ cotMock: vi.fn(), emisorMock: vi.fn(), active: { organizationId: "org-a" as string | null } }));
vi.mock("@/features/cotizacion/services", () => ({ fetchCotizacionById: cotMock }));
vi.mock("@/pdf/emisor", () => ({ cargarEmisorDocumento: emisorMock }));
vi.mock("@/hooks/shared/useOrgActiva", () => ({ useOrgActiva: () => active }));

import { createWrapper } from "@/test/utils/queryWrapper";
import { usePdfPreviewCotizacionPage } from "../usePdfPreviewCotizacionPage";
import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";

beforeEach(() => {
  cotMock.mockReset();
  emisorMock.mockReset();
  active.organizationId = "org-a";
  setAuthSnapshot({ userId: "u1", email: null, organizationId: null, organizationName: null, role: "super_admin", effectiveRole: "super_admin" });
  syncActiveOrganizationScope({ userId: "u1", organizationId: "org-a" });
});

describe("usePdfPreviewCotizacionPage", () => {
  it("trae cotización y emisor cuando hay id", async () => {
    cotMock.mockResolvedValueOnce({ id: "C-1", folio: "COT-001", organization_id: "org-a" });
    emisorMock.mockResolvedValueOnce({ rfc: "ABC010101AAA" });
    const { result } = renderHook(() => usePdfPreviewCotizacionPage("C-1"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.cotizacion.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.emisor.isSuccess).toBe(true));
    expect(cotMock).toHaveBeenCalledWith("C-1");
    expect(emisorMock).toHaveBeenCalledTimes(1);
    expect(emisorMock).toHaveBeenCalledWith("org-a");
  });

  it("no dispara la query de cotización si el id es undefined", async () => {
    emisorMock.mockResolvedValueOnce({ rfc: "ABC010101AAA" });
    const { result } = renderHook(() => usePdfPreviewCotizacionPage(undefined), { wrapper: createWrapper() });
    expect(cotMock).not.toHaveBeenCalled();
    expect(emisorMock).not.toHaveBeenCalled();
    expect(result.current.cotizacion.fetchStatus).toBe("idle");
  });

  it("no muestra identidad de otra organización aunque el detalle sea accesible", async () => {
    cotMock.mockResolvedValueOnce({ id: "C-1", organization_id: "org-b" });
    const { result } = renderHook(() => usePdfPreviewCotizacionPage("C-1"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.cotizacion.isError).toBe(true));
    expect(emisorMock).not.toHaveBeenCalled();
  });

  it("descarta el detalle tardío después de cambiar tenant", async () => {
    let resolve!: (data: unknown) => void;
    cotMock.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const { result } = renderHook(() => usePdfPreviewCotizacionPage("C-1"), { wrapper: createWrapper() });
    await waitFor(() => expect(cotMock).toHaveBeenCalledOnce());
    syncActiveOrganizationScope({ userId: "u1", organizationId: "org-b" });
    resolve({ id: "C-1", organization_id: "org-a" });
    await waitFor(() => expect(result.current.cotizacion.isError).toBe(true));
    expect(emisorMock).not.toHaveBeenCalled();
  });
});
