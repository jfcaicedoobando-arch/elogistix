import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const notify = vi.hoisted(() => ({
  notifyWarning: vi.fn(),
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
  notifyInfo: vi.fn(),
}));
vi.mock("@/lib/ui/appFeedback", () => notify);

const svc = vi.hoisted(() => ({ verificarUuidSat: vi.fn() }));
vi.mock("@/features/cxp/services/verificarUuidSat", () => svc);

import { useVerificarUuidSat } from "../useVerificarUuidSat";

describe("useVerificarUuidSat — estatus 'No verificable'", () => {
  beforeEach(() => vi.clearAllMocks());

  it("emite advertencia con acción al portal del SAT, no un error", async () => {
    svc.verificarUuidSat.mockResolvedValue({
      estatus: "No verificable",
      raw: "N - 601 | La expresión impresa proporcionada no es válida",
    });
    const { result } = renderHook(() => useVerificarUuidSat(), { wrapper: createWrapper() });
    result.current.mutate("f1");

    await waitFor(() => expect(notify.notifyWarning).toHaveBeenCalled());
    expect(notify.notifyError).not.toHaveBeenCalled();
    const opts = notify.notifyWarning.mock.calls[0][1];
    expect(opts.title).toMatch(/no pudo procesar/i);
    expect(opts.action.label).toMatch(/portal SAT/i);
  });

  it("sigue marcando error real cuando el CFDI no existe", async () => {
    svc.verificarUuidSat.mockResolvedValue({ estatus: "No Encontrado", raw: "N - 202 | No Encontrado" });
    const { result } = renderHook(() => useVerificarUuidSat(), { wrapper: createWrapper() });
    result.current.mutate("f2");

    await waitFor(() => expect(notify.notifyError).toHaveBeenCalled());
    expect(notify.notifyError.mock.calls[0][1].title).toMatch(/No encontrado/i);
  });
});
