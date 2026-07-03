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

vi.mock("@/components/shared/utils/appFeedback", () => ({
  notifyError: (...a: unknown[]) => mocks.notifyError(...a),
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
    enviarMock.mockReset();
    successMock.mockReset();
    warningMock.mockReset();
    notifyErrorMock.mockReset();
  });

  it("onSuccess (enviado) llama toast.success", async () => {
    enviarMock.mockResolvedValue({ estado: "enviado", resultados: [] });
    const { result } = renderHook(() => useEnviarFacturaEmail("f1"), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    await waitFor(() => expect(successMock).toHaveBeenCalled());
  });

  it("onSuccess (parcial) llama toast.warning", async () => {
    enviarMock.mockResolvedValue({ estado: "parcial", resultados: [] });
    const { result } = renderHook(() => useEnviarFacturaEmail("f1"), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    await waitFor(() => expect(warningMock).toHaveBeenCalled());
  });

  it("onError llama notifyError con el mensaje", async () => {
    enviarMock.mockRejectedValue(new Error("kapow"));
    const { result } = renderHook(() => useEnviarFacturaEmail("f1"), {
      wrapper: createWrapper(),
    });
    await act(async () => {
      await result.current
        .mutateAsync(input)
        .catch(() => undefined);
    });
    await waitFor(() => expect(notifyErrorMock).toHaveBeenCalled());
    const [, opts] = notifyErrorMock.mock.calls.at(-1) as [unknown, { title: string }];
    expect(opts.title).toBe("kapow");
  });
});
