/**
 * Paso 10 de la auditoría: la aprobación interna invalida el prefijo canónico
 * `proformas.all` y ya NO el root muerto ["proforma"].
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { createWrapper } from "@/test/utils/queryWrapper";
import { queryKeys } from "@/lib/query";

const aceptarSvc = vi.fn();

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));
vi.mock("@/features/proformas/services/respuestaCliente", () => ({
  aceptarProformaSinAutorizacion: (...a: unknown[]) => aceptarSvc(...a),
}));

import { useAprobarProformaInterna } from "../useAprobarProformaInterna";

describe("useAprobarProformaInterna", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invalida proformas.all y no el root muerto ['proforma']", async () => {
    const spy = vi.spyOn(QueryClient.prototype, "invalidateQueries");
    aceptarSvc.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useAprobarProformaInterna(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      result.current.aprobar("p-1");
      await new Promise((r) => setTimeout(r, 0));
    });

    const keys = spy.mock.calls.map((c) =>
      JSON.stringify((c[0] as { queryKey?: unknown } | undefined)?.queryKey),
    );
    expect(keys).toContain(JSON.stringify(queryKeys.proformas.all));
    expect(keys).not.toContain(JSON.stringify(["proforma"]));
  });
});
