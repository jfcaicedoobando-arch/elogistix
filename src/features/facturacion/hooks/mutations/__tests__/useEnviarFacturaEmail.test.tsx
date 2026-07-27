import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const mocks = vi.hoisted(() => ({
  enviar: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("@/features/facturacion/services/mutations/enviarFacturaEmail", () => ({
  enviarFacturaPorEmail: (i: unknown) => mocks.enviar(i),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => mocks.success(...a),
    warning: (...a: unknown[]) => mocks.warning(...a),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...a: unknown[]) => mocks.notifyError(...a),
  notifySuccess: (_t: unknown, opts: { title: string }) => mocks.success(opts?.title),
  notifyWarning: (_t: unknown, opts: { title: string }) => mocks.warning(opts?.title),
}));

import { useEnviarFacturaEmail } from "../useEnviarFacturaEmail";

const input = {
  facturaId: "f1",
  destinatarios: [{ email: "a@b.com" }],
  cc: [],
  asunto: "s",
  mensaje: "m",
  ejecutivo: {},
};

describe("useEnviarFacturaEmail", () => {
  beforeEach(() => {
    mocks.enviar.mockReset();
    mocks.success.mockReset();
    mocks.warning.mockReset();
    mocks.notifyError.mockReset();
  });

  it("onSuccess (enviado) llama toast.success", async () => {
    mocks.enviar.mockResolvedValue({ estado: "enviado", resultados: [] });
    const { result } = renderHook(() => useEnviarFacturaEmail("f1"), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    await waitFor(() => expect(mocks.success).toHaveBeenCalled());
  });

  it("onSuccess (parcial) llama toast.warning", async () => {
    mocks.enviar.mockResolvedValue({ estado: "parcial", resultados: [] });
    const { result } = renderHook(() => useEnviarFacturaEmail("f1"), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    await waitFor(() => expect(mocks.warning).toHaveBeenCalled());
  });

  it("onError llama notifyError con el mensaje", async () => {
    mocks.enviar.mockRejectedValue(new Error("kapow"));
    const { result } = renderHook(() => useEnviarFacturaEmail("f1"), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current
        .mutateAsync(input)
        .catch(() => undefined);
    });
    await waitFor(() => expect(mocks.notifyError).toHaveBeenCalled());
    const [, opts] = mocks.notifyError.mock.calls.at(-1) as [unknown, { title: string }];
    expect(opts.title).toBe("kapow");
  });
});
