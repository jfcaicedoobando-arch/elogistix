import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const notifyError = vi.fn();
const notifySuccess = vi.fn();
vi.mock("@/lib/ui/appFeedback", () => ({
  notifyError: (...args: unknown[]) => notifyError(...args),
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

const supabaseMock = vi.hoisted(() => ({
  functions: { invoke: vi.fn() },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { useEstadoCuentaEmail } from "@/features/cobranza/hooks/useEstadoCuentaEmail";

beforeEach(() => {
  supabaseMock.functions.invoke.mockReset();
  notifyError.mockReset();
  notifySuccess.mockReset();
});

describe("useEstadoCuentaEmail", () => {
  it("camino feliz: notifica éxito y llama onSuccess", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: true, enviado_a: "cliente@correo.mx" },
      error: null,
    });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useEstadoCuentaEmail({ onSuccess }), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ clienteId: "cli-1" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalled();
    expect(notifySuccess).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "Estado de cuenta enviado" }),
    );
    expect(notifyError).not.toHaveBeenCalled();
  });

  it("caso borde: sin contacto ni periodo (lista de campos opcionales vacía)", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { ok: true, enviado_a: "cliente@correo.mx" },
      error: null,
    });

    const { result } = renderHook(() => useEstadoCuentaEmail(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({ clienteId: "cli-2" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
      "cxc-estado-cuenta-enviar",
      expect.objectContaining({
        body: expect.objectContaining({ periodo: null, contacto_email: null }),
      }),
    );
  });

  it("maneja error de supabase notificando el error", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error("edge function caída"),
    });

    const { result } = renderHook(() => useEstadoCuentaEmail(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({ clienteId: "cli-3" });
      } catch {
        // esperado
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(notifyError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "No se pudo enviar el estado de cuenta" }),
    );
  });
});
